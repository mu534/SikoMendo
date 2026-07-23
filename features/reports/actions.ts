"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import type { ReportType, ReportFormat, Prisma } from "@prisma/client";

export async function generateReport(
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string; title: string }>> {
  const session = await getServerSession();

  return withPermission(session, "GENERATE_REPORTS", async () => {
    const type = formData.get("type") as ReportType;
    const format = (formData.get("format") as ReportFormat) ?? "PDF";

    if (!type) throw new Error("Report type is required.");

    const REPORT_TITLES: Record<ReportType, string> = {
      EMPLOYEE_DIRECTORY: "Employee Directory",
      ATTENDANCE_SUMMARY: "Attendance Summary",
      COOPERATIVE_LISTING: "Cooperative Listing",
      HEADCOUNT: "Headcount Report",
      AUDIT_LOG: "Audit Log",
    };

    const title = REPORT_TITLES[type] ?? type;

    // Collect relevant data based on report type
    let parameters: Prisma.InputJsonValue = {};

    if (type === "EMPLOYEE_DIRECTORY") {
      const count = await prisma.employee.count({ where: { deletedAt: null } });
      parameters = { totalEmployees: count };
    } else if (type === "ATTENDANCE_SUMMARY") {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const counts = await prisma.attendance.groupBy({
        by: ["status"],
        _count: true,
        where: { date: { gte: startOfMonth } },
      });
      parameters = { month: startOfMonth.toISOString().slice(0, 7), breakdown: counts };
    } else if (type === "COOPERATIVE_LISTING") {
      const count = await prisma.cooperative.count({ where: { deletedAt: null } });
      parameters = { totalCooperatives: count };
    } else if (type === "HEADCOUNT") {
      const [total, active] = await Promise.all([
        prisma.employee.count({ where: { deletedAt: null } }),
        prisma.employee.count({ where: { deletedAt: null, employmentStatus: "ACTIVE" } }),
      ]);
      parameters = { total, active };
    } else if (type === "AUDIT_LOG") {
      const count = await prisma.auditLog.count();
      parameters = { totalEntries: count };
    }

    const report = await prisma.report.create({
      data: {
        title,
        type,
        format,
        parameters,
        generatedById: session!.user.id,
      },
    });

    revalidatePath("/reports");
    return { id: report.id, title: report.title };
  });
}
