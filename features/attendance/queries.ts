import "server-only";
import prisma from "@/lib/prisma";
import type { AttendanceStatus, Prisma } from "@prisma/client";

function parseDateOnly(dateStr: string): Date {
  // Stored as @db.Date — normalize to midnight UTC so equality/unique lookups match.
  return new Date(`${dateStr}T00:00:00.000Z`);
}

export async function getDailyRegister({ date, status }: { date: string; status?: string }) {
  const dateValue = parseDateOnly(date);

  const employees = await prisma.employee.findMany({
    where: {
      deletedAt: null,
      employmentStatus: "ACTIVE",
    },
    include: {
      attendances: { where: { date: dateValue } },
      department: { select: { name: true } },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  const summary = { present: 0, absent: 0, late: 0, halfDay: 0, excused: 0, onLeave: 0, unmarked: 0 };
  for (const emp of employees) {
    const record = emp.attendances[0];
    if (!record) summary.unmarked++;
    else if (record.status === "PRESENT") summary.present++;
    else if (record.status === "ABSENT") summary.absent++;
    else if (record.status === "LATE") summary.late++;
    else if (record.status === "HALF_DAY") summary.halfDay++;
    else if (record.status === "EXCUSED") summary.excused++;
    else if (record.status === "ON_LEAVE") summary.onLeave++;
  }

  // Filtering happens after the summary is computed, so the stat cards always
  // reflect everyone for the day regardless of which status the list is filtered to.
  const filteredEmployees = status
    ? employees.filter((emp) => {
        const record = emp.attendances[0];
        if (status === "UNMARKED") return !record;
        return record?.status === status;
      })
    : employees;

  return { employees: filteredEmployees, summary, dateValue };
}

export { parseDateOnly };

// ── Employee self-service: My Attendance ────────────────────────────────────

export type MyAttendanceFilters = {
  employeeId: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  page: number;
};

const MY_ATTENDANCE_PAGE_SIZE = 15;

export async function getMyAttendanceHistory({ employeeId, startDate, endDate, status, page }: MyAttendanceFilters) {
  const where: Prisma.AttendanceWhereInput = {
    employeeId,
    ...(startDate || endDate
      ? {
          date: {
            ...(startDate ? { gte: parseDateOnly(startDate) } : {}),
            ...(endDate ? { lte: parseDateOnly(endDate) } : {}),
          },
        }
      : {}),
    ...(status ? { status: status as AttendanceStatus } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.attendance.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * MY_ATTENDANCE_PAGE_SIZE,
      take: MY_ATTENDANCE_PAGE_SIZE,
    }),
    prisma.attendance.count({ where }),
  ]);

  return { items, total, totalPages: Math.max(1, Math.ceil(total / MY_ATTENDANCE_PAGE_SIZE)) };
}

/** Lifetime stats for the employee's own attendance — not affected by the list's filters. */
export async function getMyAttendanceStats(employeeId: string) {
  const counts = await prisma.attendance.groupBy({
    by: ["status"],
    _count: true,
    where: { employeeId },
  });

  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count])) as Record<string, number>;
  const totalRecorded = counts.reduce((sum, c) => sum + c._count, 0);
  const present = byStatus.PRESENT ?? 0;
  const late = byStatus.LATE ?? 0;
  const absent = byStatus.ABSENT ?? 0;

  return {
    totalWorkingDays: present + late + (byStatus.HALF_DAY ?? 0),
    lateArrivals: late,
    absences: absent,
    attendanceRate: totalRecorded > 0 ? Math.round(((present + late) / totalRecorded) * 100) : null,
  };
}
