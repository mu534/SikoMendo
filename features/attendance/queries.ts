import "server-only";
import prisma from "@/lib/prisma";

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
