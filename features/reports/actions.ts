"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { buildReportFile } from "./file-builder";
import type { ReportType, ReportFormat, Prisma } from "@prisma/client";

const REPORT_TITLES: Record<ReportType, string> = {
  EMPLOYEE_DIRECTORY: "Employee Directory",
  ATTENDANCE_SUMMARY: "Attendance Summary",
  COOPERATIVE_LISTING: "Cooperative Listing",
  HEADCOUNT: "Headcount Report",
  AUDIT_LOG: "Audit Log",
};

const VALID_TYPES = new Set(Object.keys(REPORT_TITLES));
const VALID_FORMATS = new Set(["PDF", "CSV"]);

export async function generateReport(
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string; title: string }>> {
  const session = await getServerSession();

  return withPermission(session, "GENERATE_REPORTS", async () => {
    const type = formData.get("type") as ReportType;
    const format = (formData.get("format") as ReportFormat) || "PDF";

    if (!type || !VALID_TYPES.has(type)) throw new Error("Report type is required.");
    if (!VALID_FORMATS.has(format)) throw new Error("Invalid report format.");

    const title = REPORT_TITLES[type];

    // Build the actual file (real data, rendered as PDF or CSV) and upload it
    // so report history rows have a real, working download link.
    const { buffer, mimeType, fileName, parameters } = await buildReportFile(type, format);

    const file = new File([new Uint8Array(buffer)], fileName, { type: mimeType });
    const asset = await uploadToCloudinary(file, "siko-mendo/reports", { resourceType: "auto" });

    const report = await prisma.report.create({
      data: {
        title,
        type,
        format,
        parameters: parameters as Prisma.InputJsonValue,
        fileUrl: asset.url,
        generatedById: session!.user.id,
      },
    });

    revalidatePath("/reports");
    return { id: report.id, title: report.title };
  });
}