"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { buildReportFile, type ReportFilters } from "./file-builder";
import type { ReportType, ReportFormat, Prisma } from "@prisma/client";

const REPORT_TITLES: Record<ReportType, string> = {
  EMPLOYEE_DIRECTORY: "Employee Directory",
  ATTENDANCE_SUMMARY: "Attendance Summary",
  COOPERATIVE_LISTING: "Cooperative Listing",
  HEADCOUNT: "Headcount Report",
  AUDIT_LOG: "Audit Log",
  LEAVE_SUMMARY: "Leave Summary",
};

const VALID_TYPES = new Set<string>(Object.keys(REPORT_TITLES));
const VALID_FORMATS = new Set<string>(["PDF", "CSV"]);

/** Extracts a non-empty string field from FormData, or undefined. */
function str(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}

/**
 * Build the ReportFilters object from form data.
 * Each report type reads only the fields that are relevant to it —
 * the file-builder ignores any extras — but we extract everything
 * here once so the action stays clean.
 */
function extractFilters(formData: FormData): ReportFilters {
  return {
    // Common across multiple types
    departmentId: str(formData, "departmentId"),
    employeeId: str(formData, "employeeId"),
    year: str(formData, "year"),
    startDate: str(formData, "startDate"),
    endDate: str(formData, "endDate"),

    // Employee Directory / Headcount
    employmentStatus: str(formData, "employmentStatus"),
    employmentType: str(formData, "employmentType"),

    // Attendance
    attendanceStatus: str(formData, "attendanceStatus"),

    // Leave Summary
    leaveType: str(formData, "leaveType"),
    leaveStatus: str(formData, "leaveStatus"),

    // Cooperative Listing
    cooperativeStatus: str(formData, "cooperativeStatus"),
    cooperativeType: str(formData, "cooperativeType"),
  };
}

export async function generateReport(
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string; title: string }>> {
  const session = await getServerSession();

  return withPermission(session, "GENERATE_REPORTS", async () => {
    const type = str(formData, "type") as ReportType | undefined;
    const format = (str(formData, "format") ?? "PDF") as ReportFormat;

    if (!type || !VALID_TYPES.has(type)) throw new Error("Report type is required.");
    if (!VALID_FORMATS.has(format)) throw new Error("Invalid report format.");

    const filters = extractFilters(formData);

    // Build the file from real database data with the selected filters applied
    const { buffer, mimeType, fileName, parameters, docTitle } =
      await buildReportFile(type, format, filters);

    // Upload to Cloudinary as an authenticated (private) asset
    const file = new File([new Uint8Array(buffer)], fileName, { type: mimeType });
    const asset = await uploadToCloudinary(file, "siko-mendo/reports", {
      resourceType: "auto",
      access: "authenticated",
    });

    // Use the docTitle (which embeds active filter context) as the stored title
    const title = docTitle ?? REPORT_TITLES[type];

    const report = await prisma.report.create({
      data: {
        title,
        type,
        format,
        parameters: parameters as Prisma.InputJsonValue,
        fileUrl: asset.url,
        fileKey: asset.publicId,
        fileResourceType: asset.resourceType,
        generatedById: session!.user.id,
      },
    });

    revalidatePath("/reports");
    return { id: report.id, title: report.title };
  });
}

export async function deleteReport(
  id: string
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "GENERATE_REPORTS", async () => {
    const existing = await prisma.report.findUnique({ where: { id } });
    if (!existing) throw new Error("Report not found.");

    await prisma.report.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "Report",
        entityId: id,
        changes: {
          title: existing.title,
          type: existing.type,
        } as Prisma.InputJsonValue,
        userId: session!.user.id,
      },
    });

    revalidatePath("/reports");
    return { id };
  });
}
