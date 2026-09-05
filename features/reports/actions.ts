"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { buildReportFile, type ReportFilters } from "./file-builder";
import { getSubordinateIds } from "@/features/employees/queries";
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

// ── Report types that contain employee-scoped data ──────────────────────────
// Cooperative and Audit Log are organisation-wide and don't reference
// individual employees, so they are excluded from Manager scoping.
const EMPLOYEE_SCOPED_REPORT_TYPES = new Set<string>([
  "EMPLOYEE_DIRECTORY",
  "ATTENDANCE_SUMMARY",
  "LEAVE_SUMMARY",
  "HEADCOUNT",
]);

/** Extracts a non-empty string field from FormData, or undefined. */
function str(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}

function extractFilters(formData: FormData): ReportFilters {
  return {
    departmentId:      str(formData, "departmentId"),
    employeeId:        str(formData, "employeeId"),
    year:              str(formData, "year"),
    startDate:         str(formData, "startDate"),
    endDate:           str(formData, "endDate"),
    employmentStatus:  str(formData, "employmentStatus"),
    employmentType:    str(formData, "employmentType"),
    attendanceStatus:  str(formData, "attendanceStatus"),
    leaveType:         str(formData, "leaveType"),
    leaveStatus:       str(formData, "leaveStatus"),
    cooperativeStatus: str(formData, "cooperativeStatus"),
    cooperativeType:   str(formData, "cooperativeType"),
  };
}

/**
 * Resolves the set of employee IDs a Manager is authorised to see.
 * Returns null for Admin/HR (unrestricted) or an array for Managers.
 *
 * If the Manager has no linked employee record the array will be empty,
 * which causes every employee-scoped query to return zero rows — safe by
 * default rather than accidentally returning everything.
 */
async function resolveManagerScope(
  userId: string,
  role: string
): Promise<string[] | null> {
  if (role !== "MANAGER") return null; // unrestricted for Admin/HR

  const ownEmployee = await prisma.employee.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!ownEmployee) return []; // no linked record → empty scope

  const subordinateIds = await getSubordinateIds(ownEmployee.id);
  // Include the manager's own record so they can generate reports about
  // their own data too (e.g. their own attendance/leave summary).
  return [ownEmployee.id, ...subordinateIds];
}

/**
 * Validates that a client-supplied employeeId belongs to the Manager's
 * authorised scope. Throws if not.
 */
function assertEmployeeInScope(employeeId: string, scope: string[] | null): void {
  if (scope === null) return; // Admin/HR — no restriction
  if (!scope.includes(employeeId)) {
    throw new Error(
      "You are not authorised to generate reports for this employee."
    );
  }
}

export async function generateReport(
  _prevState: ActionResult<{ id: string; title: string }> | null,
  formData: FormData
): Promise<ActionResult<{ id: string; title: string }>> {
  const session = await getServerSession();

  return withPermission(session, "GENERATE_REPORTS", async () => {
    const type = str(formData, "type") as ReportType | undefined;
    const format = (str(formData, "format") ?? "PDF") as ReportFormat;

    if (!type || !VALID_TYPES.has(type)) throw new Error("Report type is required.");
    if (!VALID_FORMATS.has(format)) throw new Error("Invalid report format.");

    const filters = extractFilters(formData);

    // ── Manager data scoping ──────────────────────────────────────────────
    // Resolve the Manager's authorised employee scope server-side.
    // Client-submitted IDs are then validated against this scope — the UI
    // dropdown is a convenience, not a security boundary.
    const scope = await resolveManagerScope(
      session!.user.id,
      session!.user.role
    );

    if (scope !== null && EMPLOYEE_SCOPED_REPORT_TYPES.has(type)) {
      // If a specific employeeId was submitted, verify it is in scope.
      if (filters.employeeId) {
        assertEmployeeInScope(filters.employeeId, scope);
      }

      // Managers cannot generate org-wide AUDIT_LOG (not in scoped set, safe).
      // For all employee-scoped types, inject the scope as a hard constraint
      // so even if the Manager omits an employeeId filter the result is still
      // limited to their subordinates.
      filters.allowedEmployeeIds = scope;

      // If the Manager requested a departmentId that contains no employees
      // within their scope, the query will simply return zero rows — correct.
    }

    const { buffer, mimeType, fileName, parameters, docTitle } =
      await buildReportFile(type, format, filters);

    const file = new File([new Uint8Array(buffer)], fileName, { type: mimeType });
    const asset = await uploadToCloudinary(file, "siko-mendo/reports", {
      resourceType: "auto",
      access: "authenticated",
    });

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

  // DELETE_REPORTS is granted only to ADMIN.
  // Generating a report does not imply the right to delete it.
  return withPermission(session, "DELETE_REPORTS", async () => {
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
