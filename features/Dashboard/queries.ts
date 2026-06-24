import "server-only";
import prisma from "@/lib/prisma";

export async function getOrganizationStats() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const [totalEmployees, activeEmployees, totalCooperatives, presentToday, absentToday, pendingReports] =
    await Promise.all([
      prisma.employee.count(),
      prisma.employee.count({ where: { employmentStatus: "ACTIVE" } }),
      prisma.cooperative.count(),
      prisma.attendance.count({ where: { date: { gte: startOfDay, lt: endOfDay }, status: "PRESENT" } }),
      prisma.attendance.count({ where: { date: { gte: startOfDay, lt: endOfDay }, status: "ABSENT" } }),
      prisma.report.count(),
    ]);

  return { totalEmployees, activeEmployees, totalCooperatives, presentToday, absentToday, pendingReports };
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
