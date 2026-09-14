"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { uploadToCloudinary, deleteFromCloudinary } from "@/lib/cloudinary";
import { employeeSchema, employeeFormDataToObject } from "./schemas";
import { generateNextEmployeeId } from "./queries";
import { parseEmployeeCsv, importEmployeeRows, type ImportRowResult } from "./bulk-import";
import {
  validateManagerAssignment,
  assertPositionInDepartment,
  assertStatusChangeAllowed,
  assertArchiveSafe,
  assertRestoreSafe,
  assertDocumentBelongsToEmployee,
} from "@/lib/employee-access";
import type { Gender, MaritalStatus, EmploymentType, EducationLevel, DocumentType } from "@prisma/client";

// ── Allowed MIME types and extensions for document upload (P3-17) ─────────────

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/msword",                                                    // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
]);

const ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".jpg", ".jpeg", ".png", ".webp", ".doc", ".docx",
]);

const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

function validateDocumentFile(file: File): void {
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    throw new Error(
      `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is 10 MB.`
    );
  }

  const mimeType = file.type.toLowerCase().split(";")[0]?.trim() ?? "";
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error(
      `File type "${file.type || "unknown"}" is not allowed. Accepted types: PDF, JPEG, PNG, WebP, DOC, DOCX.`
    );
  }

  const ext = file.name.includes(".")
    ? `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`
    : "";
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(
      `File extension "${ext || "(none)"}" is not allowed. Accepted extensions: ${Array.from(ALLOWED_EXTENSIONS).join(", ")}.`
    );
  }
}

function validateDocumentTitle(title: string): void {
  if (!title || title.trim().length === 0) throw new Error("Give the document a title.");
  if (title.trim().length > 200) throw new Error("Document title must be 200 characters or fewer.");
  // Reject strings that look like path traversal or injection
  if (/[<>:"/\\|?*\x00-\x1f]/.test(title)) {
    throw new Error("Document title contains invalid characters.");
  }
}

// ── Shared audit helper ────────────────────────────────────────────────────────

async function logAudit(action: string, entityId: string, changes: unknown, userId?: string) {
  await prisma.auditLog.create({
    data: { action, entity: "Employee", entityId, changes: changes as object, userId },
  });
}

function getPhotoFile(formData: FormData): File | null {
  const file = formData.get("photo");
  return file instanceof File && file.size > 0 ? file : null;
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createEmployee(
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_EMPLOYEES", async () => {
    const parsed = employeeSchema.safeParse(employeeFormDataToObject(formData));
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }

    // P2-11: Validate department/position relationship server-side
    await assertPositionInDepartment(parsed.data.positionId, parsed.data.departmentId);

    // P0-3: Validate manager assignment (cycle detection, self-assign, archived)
    // Employee doesn't have an ID yet so we can't check self-reference by ID —
    // that check is harmless here since the employee doesn't exist yet.
    if (parsed.data.managerId) {
      const manager = await prisma.employee.findUnique({
        where: { id: parsed.data.managerId },
        select: { id: true, firstName: true, lastName: true, deletedAt: true },
      });
      if (!manager) throw new Error("The selected manager does not exist.");
      if (manager.deletedAt) {
        throw new Error(
          `${manager.firstName} ${manager.lastName} is archived and cannot be assigned as a manager.`
        );
      }
    }

    // Upload photo BEFORE the transaction so we can pass the URL into the create.
    // If the transaction fails we clean up the uploaded asset.
    const photo = getPhotoFile(formData);
    const asset = photo
      ? await uploadToCloudinary(photo, "siko-mendo/employees", { resourceType: "image" })
      : null;

    try {
      const employeeId = await generateNextEmployeeId();

      // P2-13: Wrap Employee + EmploymentHistory + OnboardingRecord in one transaction
      const employee = await prisma.$transaction(async (tx) => {
        const created = await tx.employee.create({
          data: {
            employeeId,
            firstName:    parsed.data.firstName,
            middleName:   parsed.data.middleName ?? null,
            lastName:     parsed.data.lastName,
            email:        parsed.data.email ?? null,
            phone:        parsed.data.phone ?? null,
            gender:       (parsed.data.gender as Gender) ?? null,
            dateOfBirth:  parsed.data.dateOfBirth ?? null,
            maritalStatus: (parsed.data.maritalStatus as MaritalStatus) ?? null,
            address:      parsed.data.address ?? null,
            emergencyContactName:         parsed.data.emergencyContactName ?? null,
            emergencyContactPhone:        parsed.data.emergencyContactPhone ?? null,
            emergencyContactRelationship: parsed.data.emergencyContactRelationship ?? null,
            emergencyContactAddress:      parsed.data.emergencyContactAddress ?? null,
            departmentId:   parsed.data.departmentId,
            positionId:     parsed.data.positionId,
            hireDate:       parsed.data.hireDate ?? null,
            employmentStatus: "ONBOARDING", // Always start in ONBOARDING
            employmentType: (parsed.data.employmentType as EmploymentType) ?? null,
            educationLevel: (parsed.data.educationLevel as EducationLevel) ?? null,
            fieldOfStudy:   parsed.data.fieldOfStudy ?? null,
            institutionName: parsed.data.institutionName ?? null,
            graduationYear:  parsed.data.graduationYear ?? null,
            profileImageUrl: asset?.url ?? null,
            profileImageKey: asset?.publicId ?? null,
            managerId:      parsed.data.managerId ?? null,
          },
        });

        await tx.employmentHistory.create({
          data: {
            employeeId: created.id,
            departmentId:   parsed.data.departmentId,
            positionId:     parsed.data.positionId,
            employmentType: (parsed.data.employmentType as EmploymentType) ?? null,
            effectiveDate:  parsed.data.hireDate ?? new Date(),
            changeReason:   "Initial hire",
          },
        });

        await tx.onboardingRecord.create({
          data: {
            employeeId: created.id,
            responsibleHrId: session?.user.id,
          },
        });

        return created;
      });

      await logAudit(
        "CREATE",
        employee.id,
        { employeeId, name: `${employee.firstName} ${employee.lastName}` },
        session?.user.id
      );

      revalidatePath("/employees");
      return { id: employee.id };
    } catch (err) {
      // If the DB transaction failed, clean up the uploaded photo
      if (asset) {
        await deleteFromCloudinary(asset.publicId, "image").catch(() => {/* non-fatal */});
      }
      throw err;
    }
  });
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateEmployee(
  id: string,
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_EMPLOYEES", async () => {
    const parsed = employeeSchema.safeParse(employeeFormDataToObject(formData));
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }

    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) throw new Error("Employee not found.");

    // Dept/position/employmentType must only change via recordEmploymentChange()
    if (
      parsed.data.departmentId !== existing.departmentId ||
      parsed.data.positionId !== existing.positionId ||
      (parsed.data.employmentType ?? null) !== (existing.employmentType ?? null)
    ) {
      throw new Error(
        "Department, position, and employment type can't be changed from this form. Use \"Record employment change\" on this employee's profile instead — it keeps their employment history accurate."
      );
    }

    // P1-8: Prevent direct lifecycle-status bypass via the general edit form
    assertStatusChangeAllowed(existing.employmentStatus, parsed.data.employmentStatus);

    // P0-3: Validate manager assignment
    await validateManagerAssignment(id, parsed.data.managerId);

    const photo = getPhotoFile(formData);
    const asset = photo
      ? await uploadToCloudinary(photo, "siko-mendo/employees", { resourceType: "image" })
      : null;

    await prisma.employee.update({
      where: { id },
      data: {
        firstName:    parsed.data.firstName,
        middleName:   parsed.data.middleName ?? null,
        lastName:     parsed.data.lastName,
        email:        parsed.data.email ?? null,
        phone:        parsed.data.phone ?? null,
        gender:       (parsed.data.gender as Gender) ?? null,
        dateOfBirth:  parsed.data.dateOfBirth ?? null,
        maritalStatus: (parsed.data.maritalStatus as MaritalStatus) ?? null,
        address:      parsed.data.address ?? null,
        emergencyContactName:         parsed.data.emergencyContactName ?? null,
        emergencyContactPhone:        parsed.data.emergencyContactPhone ?? null,
        emergencyContactRelationship: parsed.data.emergencyContactRelationship ?? null,
        emergencyContactAddress:      parsed.data.emergencyContactAddress ?? null,
        hireDate:         parsed.data.hireDate ?? null,
        employmentStatus: parsed.data.employmentStatus,
        educationLevel:   (parsed.data.educationLevel as EducationLevel) ?? null,
        fieldOfStudy:     parsed.data.fieldOfStudy ?? null,
        institutionName:  parsed.data.institutionName ?? null,
        graduationYear:   parsed.data.graduationYear ?? null,
        managerId:        parsed.data.managerId ?? null,
        ...(asset ? { profileImageUrl: asset.url, profileImageKey: asset.publicId } : {}),
      },
    });

    if (asset && existing.profileImageKey) {
      await deleteFromCloudinary(existing.profileImageKey, "image").catch(() => {/* non-fatal */});
    }

    await logAudit("UPDATE", id, { updatedBy: session?.user.name }, session?.user.id);

    revalidatePath("/employees");
    revalidatePath(`/employees/${id}`);
    return { id };
  });
}

// ── Archive / Restore ─────────────────────────────────────────────────────────

/**
 * Archives (soft-deletes) an employee.
 *
 * P1-9: Active/onboarding employees cannot be archived directly.
 * They must complete the offboarding workflow first.
 *
 * Terminal-status employees (RESIGNED, RETIRED, TERMINATED, etc.) can be
 * archived directly since they have already passed through offboarding.
 */
export async function archiveEmployee(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();
  return withPermission(session, "MANAGE_EMPLOYEES", async () => {
    // P1-9: Enforce archiving guard
    await assertArchiveSafe(id, session!.user.role);

    await prisma.employee.update({ where: { id }, data: { deletedAt: new Date() } });
    await logAudit("ARCHIVE", id, { archivedBy: session?.user.name }, session?.user.id);
    revalidatePath("/employees");
    return { id };
  });
}

/**
 * Restores an archived employee.
 *
 * P1-10: Restoring != rehiring. The employee's historical employment status
 * is preserved exactly. deletedAt is cleared; employmentStatus is NOT changed.
 * If rehire is needed, it requires a dedicated workflow.
 */
export async function restoreEmployee(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();
  return withPermission(session, "MANAGE_EMPLOYEES", async () => {
    // P1-10: Validate restore and confirm status is preserved (not auto-promoted)
    await assertRestoreSafe(id);

    // Only clear deletedAt — do NOT touch employmentStatus
    await prisma.employee.update({ where: { id }, data: { deletedAt: null } });
    await logAudit("RESTORE", id, { restoredBy: session?.user.name }, session?.user.id);
    revalidatePath("/employees");
    return { id };
  });
}

// ── Documents ─────────────────────────────────────────────────────────────────

export async function uploadEmployeeDocument(
  employeeId: string,
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();
  return withPermission(session, "MANAGE_DOCUMENTS", async () => {
    const file = formData.get("file");
    const title = String(formData.get("title") ?? "").trim();
    const rawType = String(formData.get("type") ?? "OTHER");

    if (!(file instanceof File) || file.size === 0) throw new Error("Choose a file to upload.");

    // P3-17: Server-side file validation
    validateDocumentFile(file);
    validateDocumentTitle(title);

    // Verify the employee exists
    const employeeExists = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!employeeExists) throw new Error("Employee not found.");

    const VALID_DOCUMENT_TYPES: DocumentType[] = [
      "CONTRACT", "ID_DOCUMENT", "CERTIFICATE", "RESUME", "OTHER",
    ];
    const documentType: DocumentType = VALID_DOCUMENT_TYPES.includes(rawType as DocumentType)
      ? (rawType as DocumentType)
      : "OTHER";

    const asset = await uploadToCloudinary(file, "siko-mendo/documents", {
      resourceType: "auto",
      access: "authenticated",
    });

    const document = await prisma.document.create({
      data: {
        title,
        type: documentType,
        fileUrl:          asset.url,
        fileKey:          asset.publicId,
        fileResourceType: asset.resourceType,
        fileName:         file.name,
        fileSize:         file.size,
        mimeType:         file.type || "application/octet-stream",
        employeeId,
        uploadedById: session?.user.id,
      },
    });

    revalidatePath(`/employees/${employeeId}`);
    return { id: document.id };
  });
}

export async function deleteEmployeeDocument(
  documentId: string,
  employeeId: string
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();
  return withPermission(session, "MANAGE_DOCUMENTS", async () => {
    // P0-5: Verify document belongs to this employee (prevents cross-employee attacks)
    const document = await assertDocumentBelongsToEmployee(documentId, employeeId);

    await prisma.document.update({ where: { id: documentId }, data: { deletedAt: new Date() } });

    // P3-18: Use stored Cloudinary resource type instead of inferring from mimeType
    const resourceType: "image" | "raw" =
      document.fileResourceType === "image" ? "image" : "raw";
    await deleteFromCloudinary(document.fileKey, resourceType);

    revalidatePath(`/employees/${employeeId}`);
    return { id: documentId };
  });
}

// ── Bulk Import ───────────────────────────────────────────────────────────────

export async function bulkImportEmployees(
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ results: ImportRowResult[]; createdCount: number; errorCount: number }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_EMPLOYEES", async () => {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("Upload a CSV file.");

    const text = await file.text();
    const { rows, parseErrors } = parseEmployeeCsv(text);
    if (rows.length === 0) throw new Error("CSV is empty or has no data rows.");
    if (parseErrors.length > 0) throw new Error(`CSV parse errors: ${parseErrors.join("; ")}`);

    const results = await importEmployeeRows(rows, session!.user.id);
    const createdCount = results.filter((r) => r.status === "created").length;
    const errorCount   = results.filter((r) => r.status === "error").length;

    revalidatePath("/employees");
    return { results, createdCount, errorCount };
  });
}
