"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { uploadToCloudinary, deleteFromCloudinary } from "@/lib/cloudinary";
import { employeeSchema, employeeFormDataToObject } from "./schemas";
import { generateNextEmployeeId } from "./queries";
import { parseEmployeeCsv, importEmployeeRows, validateEmployeeCsvRows, type ImportRowResult, type ParsedEmployeeRow } from "./bulk-import";
import { validateCsvImportFile, validateEmployeeDocumentFile, validatePhotoFile } from "@/lib/file-limits";
import {
  validateManagerAssignment,
  assertPositionInDepartment,
  assertNotManagerPosition,
  assertDeptManagerSlotAvailable,
  assertStatusChangeAllowed,
  assertArchiveSafe,
  assertRestoreSafe,
  assertDocumentBelongsToEmployee,
  resolveReportingManager,
  assertManagerBelongsToDept,
} from "@/lib/employee-access";
import type {
  Gender,
  MaritalStatus,
  EmploymentType,
  InstitutionType,
  QualificationStatus,
  DocumentType,
} from "@prisma/client";

// ── Allowed MIME types and extensions for document upload (P3-17) ─────────────
// Limits are defined in lib/file-limits.ts and enforced via validateEmployeeDocumentFile.

function validateDocumentFile(file: File): void {
  const err = validateEmployeeDocumentFile(file);
  if (err) throw new Error(err);
}

function validateDocumentTitle(title: string): void {
  if (!title || title.trim().length === 0) throw new Error("Give the document a title.");
  if (title.trim().length > 200) throw new Error("Document title must be 200 characters or fewer.");
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

// ── Profile photo validation ──────────────────────────────────────────────────
// Limit defined in lib/file-limits.ts — validatePhotoFile is imported directly.

function getPhotoFile(formData: FormData): File | null {
  const file = formData.get("photo");
  return file instanceof File && file.size > 0 ? file : null;
}

function validatePhotoFileThrow(file: File): void {
  const err = validatePhotoFile(file);
  if (err) throw new Error(err);
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createEmployee(
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_EMPLOYEES", async () => {
    if (!session?.user?.id) throw new Error("Unauthorized");
    const userId = session.user.id;

    const parsed = employeeSchema.safeParse(employeeFormDataToObject(formData));
    if (!parsed.success) {
      // Surface the consent field error if present, otherwise the first field error.
      const consentIssue = parsed.error.issues.find(
        (i) => i.path[0] === "emergencyContactConsentRecorded"
      );
      throw new Error(consentIssue?.message ?? parsed.error.issues[0]?.message ?? "Invalid input.");
    }

    // P2-11: Validate department/position relationship server-side
    await assertPositionInDepartment(parsed.data.positionId, parsed.data.departmentId);

    const photo = getPhotoFile(formData);
    if (photo) validatePhotoFileThrow(photo);
    const asset = photo
      ? await uploadToCloudinary(photo, "siko-mendo/employees", { resourceType: "image" })
      : null;

    try {
      const employeeId = await generateNextEmployeeId();

      // P2-13: Wrap Employee + EmploymentHistory + OnboardingRecord + Education in one transaction
      // Serializable isolation prevents a TOCTOU race where two simultaneous requests
      // could both pass the manager-position check and both create employees in the same position.
      const employee = await prisma.$transaction(async (tx) => {
        // P3-new: Reject if the submitted position is already held by the department manager.
        await assertNotManagerPosition(tx, parsed.data.departmentId, parsed.data.positionId);

        // FEAT-001: Reject if the submitted position is a manager-type position
        // and the department already has an active Department Manager (even if the
        // current manager has no positionId set — assertNotManagerPosition alone
        // would not catch that case).
        await assertDeptManagerSlotAvailable(tx, parsed.data.departmentId, parsed.data.positionId);

        // FEAT-001 Rule 9 + Rule 2: Server-authoritatively derive the reporting manager
        // from the department's active DM. Client-supplied managerId is ignored.
        // Throws deptHasNoActiveManager if the dept has no active DM.
        const resolvedManagerId = await resolveReportingManager(
          tx,
          parsed.data.departmentId,
          "new-employee-placeholder" // New employee doesn't have an ID yet; self-assignment impossible here
        );

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
            emergencyContactAltPhone:     parsed.data.emergencyContactAltPhone ?? null,
            emergencyContactEmail:        parsed.data.emergencyContactEmail ?? null,
            emergencyContactAddressCity:       parsed.data.emergencyContactAddressCity ?? null,
            emergencyContactAddressRegion:     parsed.data.emergencyContactAddressRegion ?? null,
            emergencyContactAddressPostalCode: parsed.data.emergencyContactAddressPostalCode ?? null,
            emergencyContact2Name:         parsed.data.emergencyContact2Name ?? null,
            emergencyContact2Phone:        parsed.data.emergencyContact2Phone ?? null,
            emergencyContact2Relationship: parsed.data.emergencyContact2Relationship ?? null,
            emergencyContactConsentRecorded:   parsed.data.emergencyContactConsentRecorded ?? false,
            ...(parsed.data.emergencyContactConsentRecorded
              ? {
                  emergencyContactConsentAt:         new Date(),
                  emergencyContactConsentByUserId:   userId,
                }
              : {}),
            departmentId:   parsed.data.departmentId,
            positionId:     parsed.data.positionId,
            hireDate:       parsed.data.hireDate ?? null,
            employmentStatus: "ONBOARDING",
            employmentType: (parsed.data.employmentType as EmploymentType) ?? null,
            profileImageUrl: asset?.url ?? null,
            profileImageKey: asset?.publicId ?? null,
            managerId:      resolvedManagerId,
          },
        });

        // Write education records
        if (parsed.data.educations.length > 0) {
          await tx.education.createMany({
            data: parsed.data.educations.map((edu) => ({
              employeeId:          created.id,
              educationLevel:      edu.educationLevel as import("@prisma/client").EducationLevel,
              fieldOfStudy:        edu.fieldOfStudy ?? null,
              institutionType:     (edu.institutionType as InstitutionType) ?? null,
              institutionName:     edu.institutionName ?? null,
              graduationYear:      edu.graduationYear ?? null,
              qualificationStatus: (edu.qualificationStatus as QualificationStatus) ?? null,
            })),
          });
        }

        await tx.employmentHistory.create({
          data: {
            employeeId:     created.id,
            departmentId:   parsed.data.departmentId,
            positionId:     parsed.data.positionId,
            employmentType: (parsed.data.employmentType as EmploymentType) ?? null,
            effectiveDate:  parsed.data.hireDate ?? new Date(),
            changeReason:   "Initial hire",
            previousManagerId: null,
            newManagerId:   resolvedManagerId,
          },
        });

        await tx.onboardingRecord.create({
          data: {
            employeeId: created.id,
            responsibleHrId: userId,
          },
        });

        return created;
      }, { isolationLevel: "Serializable" });

      await logAudit(
        "CREATE",
        employee.id,
        { employeeId, name: `${employee.firstName} ${employee.lastName}` },
        userId
      );

      revalidatePath("/employees");
      return { id: employee.id };
    } catch (err) {
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
    if (!session?.user?.id) throw new Error("Unauthorized");
    const userId = session.user.id;

    const parsed = employeeSchema.safeParse(employeeFormDataToObject(formData));
    if (!parsed.success) {
      // Surface the consent field error if present, otherwise the first field error.
      const consentIssue = parsed.error.issues.find(
        (i) => i.path[0] === "emergencyContactConsentRecorded"
      );
      throw new Error(consentIssue?.message ?? parsed.error.issues[0]?.message ?? "Invalid input.");
    }

    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) throw new Error("Employee not found.");

    if (
      parsed.data.departmentId !== existing.departmentId ||
      parsed.data.positionId !== existing.positionId ||
      (parsed.data.employmentType ?? null) !== (existing.employmentType ?? null)
    ) {
      throw new Error(
        "Department, position, and employment type can't be changed from this form. Use \"Record employment change\" on this employee's profile instead — it keeps their employment history accurate."
      );
    }

    assertStatusChangeAllowed(existing.employmentStatus, parsed.data.employmentStatus);

    // FEAT-001 Rule 6: Self-assignment guard
    if (parsed.data.managerId && parsed.data.managerId === id) {
      throw new Error("An employee cannot be assigned as their own manager.");
    }

    // FEAT-001 Rule 8: Cross-dept guard — managerId must be the dept's own DM
    await assertManagerBelongsToDept(parsed.data.managerId, parsed.data.departmentId);

    // Keep existing cycle detection and archived-manager checks
    await validateManagerAssignment(id, parsed.data.managerId);

    const photo = getPhotoFile(formData);
    if (photo) validatePhotoFileThrow(photo);
    const asset = photo
      ? await uploadToCloudinary(photo, "siko-mendo/employees", { resourceType: "image" })
      : null;

    await prisma.$transaction(async (tx) => {
      await tx.employee.update({
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
          emergencyContactAltPhone:     parsed.data.emergencyContactAltPhone ?? null,
          emergencyContactEmail:        parsed.data.emergencyContactEmail ?? null,
          emergencyContactAddressCity:       parsed.data.emergencyContactAddressCity ?? null,
          emergencyContactAddressRegion:     parsed.data.emergencyContactAddressRegion ?? null,
          emergencyContactAddressPostalCode: parsed.data.emergencyContactAddressPostalCode ?? null,
          emergencyContact2Name:         parsed.data.emergencyContact2Name ?? null,
          emergencyContact2Phone:        parsed.data.emergencyContact2Phone ?? null,
          emergencyContact2Relationship: parsed.data.emergencyContact2Relationship ?? null,
          emergencyContactConsentRecorded:   parsed.data.emergencyContactConsentRecorded ?? false,
          ...(parsed.data.emergencyContactConsentRecorded
            ? {
                emergencyContactConsentAt:         new Date(),
                emergencyContactConsentByUserId:   userId,
              }
            : {}),
          hireDate:         parsed.data.hireDate ?? null,
          employmentStatus: parsed.data.employmentStatus,
          managerId:        parsed.data.managerId ?? null,
          ...(asset
            ? { profileImageUrl: asset.url, profileImageKey: asset.publicId }
            : formData.get("removePhoto") === "1"
              ? { profileImageUrl: null, profileImageKey: null }
              : {}),
        },
      });

      // Replace all education records atomically: delete existing, insert new.
      // This is simpler and safer than diffing — UI always sends the full set.
      await tx.education.deleteMany({ where: { employeeId: id } });
      if (parsed.data.educations.length > 0) {
        await tx.education.createMany({
          data: parsed.data.educations.map((edu) => ({
            employeeId:          id,
            educationLevel:      edu.educationLevel as import("@prisma/client").EducationLevel,
            fieldOfStudy:        edu.fieldOfStudy ?? null,
            institutionType:     (edu.institutionType as InstitutionType) ?? null,
            institutionName:     edu.institutionName ?? null,
            graduationYear:      edu.graduationYear ?? null,
            qualificationStatus: (edu.qualificationStatus as QualificationStatus) ?? null,
          })),
        });
      }
    });

    if (asset && existing.profileImageKey) {
      // Replaced with a new photo — delete the old one
      await deleteFromCloudinary(existing.profileImageKey, "image").catch(() => {/* non-fatal */});
    } else if (formData.get("removePhoto") === "1" && existing.profileImageKey) {
      // User explicitly removed the photo — delete from Cloudinary
      await deleteFromCloudinary(existing.profileImageKey, "image").catch(() => {/* non-fatal */});
    }

    await logAudit("UPDATE", id, { updatedBy: session?.user.name }, userId);

    revalidatePath("/employees");
    revalidatePath(`/employees/${id}`);
    return { id };
  });
}

// ── Archive / Restore ─────────────────────────────────────────────────────────

export async function archiveEmployee(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();
  return withPermission(session, "MANAGE_EMPLOYEES", async () => {
    await assertArchiveSafe(id, session!.user.role);

    // FEAT-001 Rule 5: Archive cascade inside a Serializable transaction.
    // If the employee being archived is a Department Manager:
    //   1. Null out Department.managerId (removes the DM pointer)
    //   2. Null out Employee.managerId for all their direct reports
    //      (prevents orphaned reporting relationships)
    // Then soft-delete the employee — all atomically.
    await prisma.$transaction(async (tx) => {
      // Check if this employee is a department manager
      const managedDept = await tx.department.findFirst({
        where: { managerId: id },
        select: { id: true },
      });

      if (managedDept) {
        // Remove the DM pointer from the department
        await tx.department.update({
          where: { id: managedDept.id },
          data: { managerId: null },
        });

        // Null out direct reports' managerId so they are not orphaned
        await tx.employee.updateMany({
          where: { managerId: id, deletedAt: null },
          data: { managerId: null },
        });

        // Audit the cascade so it is visible in the log
        await tx.auditLog.create({
          data: {
            action: "MANAGER_VACATED",
            entity: "Department",
            entityId: managedDept.id,
            changes: { vacatedManagerId: id, reason: "employee_archived" },
            userId: session?.user.id,
          },
        });
      }

      // Soft-delete the employee
      await tx.employee.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    }, { isolationLevel: "Serializable" });

    await logAudit("ARCHIVE", id, { archivedBy: session?.user.name }, session?.user.id);
    revalidatePath("/employees");
    return { id };
  });
}

export async function restoreEmployee(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();
  return withPermission(session, "MANAGE_EMPLOYEES", async () => {
    await assertRestoreSafe(id);
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

    validateDocumentFile(file);
    validateDocumentTitle(title);

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
    const document = await assertDocumentBelongsToEmployee(documentId, employeeId);

    await prisma.document.update({ where: { id: documentId }, data: { deletedAt: new Date() } });

    const resourceType: "image" | "raw" =
      document.fileResourceType === "image" ? "image" : "raw";
    await deleteFromCloudinary(document.fileKey, resourceType);

    revalidatePath(`/employees/${employeeId}`);
    return { id: documentId };
  });
}

// ── Validate Import CSV (preview step — no DB writes) ────────────────────────

export async function validateImportCsv(
  _prevState: unknown,
  formData: FormData
): Promise<
  ActionResult<{
    summary: { total: number; valid: number; invalid: number };
    validRows: ParsedEmployeeRow[];
    invalidRows: { rowIndex: number; name: string; errors: string[] }[];
  }>
> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_EMPLOYEES", async () => {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("Upload a CSV file to validate.");
    }

    const sizeErr = validateCsvImportFile(file);
    if (sizeErr) throw new Error(sizeErr);

    const text = await file.text();
    const { rows, parseErrors } = parseEmployeeCsv(text);

    if (parseErrors.length > 0) {
      throw new Error(`CSV parse errors: ${parseErrors.join("; ")}`);
    }

    if (rows.length === 0) {
      throw new Error("The CSV file is empty or contains no data rows.");
    }

    // Extract header names from the first parsed row's keys (PapaParse header mode)
    const headers = rows.length > 0 ? Object.keys(rows[0]!) : [];

    const { validRows, invalidRows } = await validateEmployeeCsvRows(rows, headers);

    return {
      summary: {
        total: rows.length,
        valid: validRows.length,
        invalid: invalidRows.length,
      },
      validRows,
      invalidRows,
    };
  });
}


export async function bulkImportEmployees(
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ results: ImportRowResult[]; createdCount: number; errorCount: number }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_EMPLOYEES", async () => {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("Upload a CSV file.");

    const sizeErr = validateCsvImportFile(file);
    if (sizeErr) throw new Error(sizeErr);

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
