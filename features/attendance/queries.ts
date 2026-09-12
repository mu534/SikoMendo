import "server-only";
import prisma from "@/lib/prisma";
import { parseDateOnly } from "@/lib/attendance-date";
import type { AttendanceStatus, Prisma } from "@prisma/client";

// Re-export so existing callers that import parseDateOnly from this file continue to work.
export { parseDateOnly };

// ── Admin: full daily register ───────────────────────────────────────────────

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

  const summary = buildSummary(employees);

  const filteredEmployees = status
    ? employees.filter((emp) => {
        const record = emp.attendances[0];
        if (status === "UNMARKED") return !record;
        return record?.status === status;
      })
    : employees;

  return { employees: filteredEmployees, summary, dateValue };
}

// ── Manager: scoped daily register (read-only) ───────────────────────────────

/**
 * Returns the daily register scoped to a specific set of employee IDs.
 * Used by the Manager view to show only their reporting hierarchy.
 *
 * Security: the allowedIds list is derived server-side from the manager's
 * own employee record — never from client input.
 */
export async function getDailyRegisterScoped({
  date,
  status,
  allowedIds,
}: {
  date: string;
  status?: string;
  allowedIds: string[];
}) {
  if (allowedIds.length === 0) {
    const empty = { present: 0, absent: 0, late: 0, halfDay: 0, excused: 0, onLeave: 0, unmarked: 0 };
    return { employees: [], summary: empty, dateValue: parseDateOnly(date) };
  }

  const dateValue = parseDateOnly(date);

  const employees = await prisma.employee.findMany({
    where: {
      id: { in: allowedIds },
      deletedAt: null,
      employmentStatus: "ACTIVE",
    },
    include: {
      attendances: { where: { date: dateValue } },
      department: { select: { name: true } },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  const summary = buildSummary(employees);

  const filteredEmployees = status
    ? employees.filter((emp) => {
        const record = emp.attendances[0];
        if (status === "UNMARKED") return !record;
        return record?.status === status;
      })
    : employees;

  return { employees: filteredEmployees, summary, dateValue };
}

// ── Shared summary builder ────────────────────────────────────────────────────

function buildSummary(
  employees: Array<{ attendances: Array<{ status: string }> }>
) {
  const summary = {
    present: 0, absent: 0, late: 0, halfDay: 0,
    excused: 0, onLeave: 0, unmarked: 0,
  };
  for (const emp of employees) {
    const record = emp.attendances[0];
    if (!record)                      summary.unmarked++;
    else if (record.status === "PRESENT")  summary.present++;
    else if (record.status === "ABSENT")   summary.absent++;
    else if (record.status === "LATE")     summary.late++;
    else if (record.status === "HALF_DAY") summary.halfDay++;
    else if (record.status === "EXCUSED")  summary.excused++;
    else if (record.status === "ON_LEAVE") summary.onLeave++;
  }
  return summary;
}

// ── Self-service: today's own attendance record ───────────────────────────────

/**
 * Returns the authenticated employee's attendance record for the given date
 * (the org-local today, already computed by the caller).
 *
 * Security: `employeeId` must be derived from `session.user.id` by the caller —
 * never accepted from a URL param or form field.
 */
export async function getTodayAttendance(employeeId: string, todayStr: string) {
  const dateValue = parseDateOnly(todayStr);
  return prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId, date: dateValue } },
    select: {
      id: true,
      status: true,
      checkIn: true,
      checkOut: true,
      notes: true,
    },
  });
}

// ── Self-service: own attendance history (paginated) ─────────────────────────

export type MyAttendanceFilters = {
  employeeId: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  page: number;
};

const MY_ATTENDANCE_PAGE_SIZE = 15;

/**
 * Paginated attendance history for one employee.
 *
 * Security: `employeeId` must always be resolved from the session by the caller.
 * This query trusts whatever `employeeId` it receives — scope enforcement is the
 * caller's responsibility (the page component derives it from the session).
 */
export async function getMyAttendanceHistory({
  employeeId,
  startDate,
  endDate,
  status,
  page,
}: MyAttendanceFilters) {
  const where: Prisma.AttendanceWhereInput = {
    employeeId,
    ...(startDate || endDate
      ? {
          date: {
            ...(startDate ? { gte: parseDateOnly(startDate) } : {}),
            ...(endDate   ? { lte: parseDateOnly(endDate)   } : {}),
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

// ── Self-service: lifetime stats for one employee ────────────────────────────

/**
 * Lifetime attendance statistics for one employee.
 * `employeeId` must be derived from the session by the caller.
 */
export async function getMyAttendanceStats(employeeId: string) {
  const counts = await prisma.attendance.groupBy({
    by: ["status"],
    _count: true,
    where: { employeeId },
  });

  const byStatus = Object.fromEntries(
    counts.map((c) => [c.status, c._count])
  ) as Record<string, number>;

  const totalRecorded = counts.reduce((sum, c) => sum + c._count, 0);
  const present  = byStatus.PRESENT   ?? 0;
  const late     = byStatus.LATE      ?? 0;
  const halfDay  = byStatus.HALF_DAY  ?? 0;
  const absent   = byStatus.ABSENT    ?? 0;

  // Working days = days where the employee was physically at work
  const totalWorkingDays = present + late + halfDay;
  // Attendance rate = working days / all days with a non-ON_LEAVE record
  const countedDays = totalRecorded - (byStatus.ON_LEAVE ?? 0);

  return {
    totalWorkingDays,
    lateArrivals: late,
    absences: absent,
    attendanceRate:
      countedDays > 0 ? Math.round((totalWorkingDays / countedDays) * 100) : null,
  };
}
