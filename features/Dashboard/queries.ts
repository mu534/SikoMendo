import "server-only";
import prisma from "@/lib/prisma";
import { LEAVE_STATUS_LABELS, type LeaveStatusValue } from "@/features/leave/schemas";

export async function getOrganizationStats() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const [totalEmployees, activeEmployees, totalCooperatives, presentToday, absentToday, onLeaveToday, pendingReports] =
    await Promise.all([
      prisma.employee.count({ where: { deletedAt: null } }),
      prisma.employee.count({ where: { employmentStatus: "ACTIVE", deletedAt: null } }),
      prisma.cooperative.count({ where: { deletedAt: null } }),
      prisma.attendance.count({ where: { date: { gte: startOfDay, lt: endOfDay }, status: "PRESENT" } }),
      prisma.attendance.count({ where: { date: { gte: startOfDay, lt: endOfDay }, status: "ABSENT" } }),
      prisma.attendance.count({ where: { date: { gte: startOfDay, lt: endOfDay }, status: "ON_LEAVE" } }),
      prisma.report.count(),
    ]);

  return { totalEmployees, activeEmployees, totalCooperatives, presentToday, absentToday, onLeaveToday, pendingReports };
}

/**
 * Real actionable items that need attention, based on live database data.
 * Used in the "Needs Attention" section of the dashboard.
 */
export async function getNeedsAttention() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thirtyDaysOut = new Date(today);
  thirtyDaysOut.setDate(today.getDate() + 30);

  const [
    pendingLeave,
    onboarding,
    offboarding,
    expiringContracts,
    missingDocuments,
  ] = await Promise.all([
    // Pending leave requests awaiting a decision
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    // Employees actively in onboarding
    prisma.employee.count({
      where: { employmentStatus: "ONBOARDING", deletedAt: null },
    }),
    // Active (in-progress) offboardings
    prisma.offboardingRecord.count({
      where: { completedAt: null, cancelledAt: null },
    }),
    // Contracts expiring within 30 days
    prisma.contract.count({
      where: {
        status: "ACTIVE",
        endDate: { gte: today, lte: thirtyDaysOut },
        employee: { deletedAt: null },
      },
    }),
    // Active employees missing a required ID document
    prisma.employee.count({
      where: {
        employmentStatus: { in: ["ACTIVE", "ONBOARDING"] },
        deletedAt: null,
        documents: { none: { type: "ID_DOCUMENT", deletedAt: null } },
      },
    }),
  ]);

  return {
    pendingLeave,
    onboarding,
    offboarding,
    expiringContracts,
    missingDocuments,
  };
}

export async function getRecentAuditLogs(limit = 6) {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { name: true } } },
  });
}

export async function getOwnAttendanceSummary(employeeId: string) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const records = await prisma.attendance.findMany({
    where: { employeeId, date: { gte: startOfMonth } },
  });

  const present = records.filter((r: { status: string }) => r.status === "PRESENT").length;
  const absent = records.filter((r: { status: string }) => r.status === "ABSENT").length;
  const late = records.filter((r: { status: string }) => r.status === "LATE").length;

  return { present, absent, late, total: records.length };
}

/** Daily present/absent counts for the last N days (default 30), including days with zero records. */
export async function getAttendanceTrend(days = 30) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const records = await prisma.attendance.findMany({
    where: { date: { gte: start } },
    select: { date: true, status: true },
  });

  const byDate = new Map<string, { present: number; absent: number; onLeave: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    byDate.set(d.toISOString().slice(0, 10), { present: 0, absent: 0, onLeave: 0 });
  }

  for (const record of records) {
    const key = record.date.toISOString().slice(0, 10);
    const bucket = byDate.get(key);
    if (!bucket) continue;
    if (record.status === "PRESENT") bucket.present += 1;
    else if (record.status === "ABSENT") bucket.absent += 1;
    else if (record.status === "ON_LEAVE") bucket.onLeave += 1;
  }

  return Array.from(byDate.entries()).map(([date, counts]) => ({
    date,
    label: new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    ...counts,
  }));
}

/** Leave request counts grouped by status, for a donut/pie chart. Zero-count statuses are omitted. */
export async function getLeaveStatusBreakdown() {
  const counts = await prisma.leaveRequest.groupBy({
    by: ["status"],
    _count: true,
  });

  const order: LeaveStatusValue[] = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];

  return order
    .map((status) => ({
      status,
      label: LEAVE_STATUS_LABELS[status],
      count: counts.find((c) => c.status === status)?._count ?? 0,
    }))
    .filter((entry) => entry.count > 0);
}

/** Active employee headcount grouped by department, for a bar chart. */
export async function getEmployeesByDepartment() {
  const departments = await prisma.department.findMany({
    include: { _count: { select: { employees: { where: { deletedAt: null } } } } },
  });

  return departments
    .map((d) => ({ department: d.name, count: d._count.employees }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);
}
