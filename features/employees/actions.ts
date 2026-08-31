"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { uploadToCloudinary, deleteFromCloudinary } from "@/lib/cloudinary";
import { employeeSchema, employeeFormDataToObject } from "./schemas";
import { generateNextEmployeeId } from "./queries";
import { parseEmployeeCsv, importEmployeeRows, type ImportRowResult } from "./bulk-import";
import type { Gender, MaritalStatus, EmploymentType, EducationLevel } from "@prisma/client";

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

    const photo = getPhotoFile(formData);
    const asset = photo
      ? await uploadToCloudinary(photo, "siko-mendo/employees", { resourceType: "image" })
      : null;

    const employeeId = await generateNextEmployeeId();

    const employee = await prisma.employee.create({
      data: {
        employeeId,
        firstName: parsed.data.firstName,
        middleName: parsed.data.middleName ?? null,
        lastName: parsed.data.lastName,
        email: parsed.data.email ?? null,
        phone: parsed.data.phone ?? null,
        gender: (parsed.data.gender as Gender) ?? null,
        dateOfBirth: parsed.data.dateOfBirth ?? null,
        maritalStatus: (parsed.data.maritalStatus as MaritalStatus) ?? null,
        address: parsed.data.address ?? null,
        emergencyContactName: parsed.data.emergencyContactName ?? null,
        emergencyContactPhone: parsed.data.emergencyContactPhone ?? null,
        emergencyContactRelationship: parsed.data.emergencyContactRelationship ?? null,
        emergencyContactAddress: parsed.data.emergencyContactAddress ?? null,
        departmentId: parsed.data.departmentId,
        positionId: parsed.data.positionId,
        hireDate: parsed.data.hireDate ?? null,
        employmentStatus: parsed.data.employmentStatus,
        employmentType: (parsed.data.employmentType as EmploymentType) ?? null,
        educationLevel: (parsed.data.educationLevel as EducationLevel) ?? null,
        fieldOfStudy: parsed.data.fieldOfStudy ?? null,
        institutionName: parsed.data.institutionName ?? null,
        graduationYear: parsed.data.graduationYear ?? null,
        profileImageUrl: asset?.url ?? null,
        profileImageKey: asset?.publicId ?? null,
      },
    });

    await logAudit(
      "CREATE",
      employee.id,
      { employeeId, name: `${employee.firstName} ${employee.lastName}` },
      session?.user.id
    );

    revalidatePath("/employees");
    return { id: employee.id };
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

    // Department, position, and employment type must only change through
    // "Record employment change" (features/employment-history/actions.ts),
    // which closes the previous EmploymentHistory row and opens a new one in
    // a transaction. Allowing this general edit form to write them directly
    // let the two go out of sync, so any attempted change here is rejected
    // rather than silently applied.
    if (
      parsed.data.departmentId !== existing.departmentId ||
      parsed.data.positionId !== existing.positionId ||
      (parsed.data.employmentType ?? null) !== (existing.employmentType ?? null)
    ) {
      throw new Error(
        "Department, position, and employment type can't be changed from this form. Use \"Record employment change\" on this employee's profile instead — it keeps their employment history accurate."
      );
    }

    const photo = getPhotoFile(formData);
    const asset = photo
      ? await uploadToCloudinary(photo, "siko-mendo/employees", { resourceType: "image" })
      : null;

    await prisma.employee.update({
      where: { id },
      data: {
        firstName: parsed.data.firstName,
        middleName: parsed.data.middleName ?? null,
        lastName: parsed.data.lastName,
        email: parsed.data.email ?? null,
        phone: parsed.data.phone ?? null,
        gender: (parsed.data.gender as Gender) ?? null,
        dateOfBirth: parsed.data.dateOfBirth ?? null,
        maritalStatus: (parsed.data.maritalStatus as MaritalStatus) ?? null,
        address: parsed.data.address ?? null,
        emergencyContactName: parsed.data.emergencyContactName ?? null,
        emergencyContactPhone: parsed.data.emergencyContactPhone ?? null,
        emergencyContactRelationship: parsed.data.emergencyContactRelationship ?? null,
        emergencyContactAddress: parsed.data.emergencyContactAddress ?? null,
        hireDate: parsed.data.hireDate ?? null,
        employmentStatus: parsed.data.employmentStatus,
        educationLevel: (parsed.data.educationLevel as EducationLevel) ?? null,
        fieldOfStudy: parsed.data.fieldOfStudy ?? null,
        institutionName: parsed.data.institutionName ?? null,
        graduationYear: parsed.data.graduationYear ?? null,
        ...(asset ? { profileImageUrl: asset.url, profileImageKey: asset.publicId } : {}),
      },
    });

    if (asset && existing.profileImageKey) {
      await deleteFromCloudinary(existing.profileImageKey);
    }

    await logAudit("UPDATE", id, { updatedBy: session?.user.name }, session?.user.id);

    revalidatePath("/employees");
    revalidatePath(`/employees/${id}`);
    return { id };
  });
}

// ── Archive / Restore ─────────────────────────────────────────────────────────

export async function archiveEmployee(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();
  return withPermission(session, "MANAGE_EMPLOYEES", async () => {
    await prisma.employee.update({ where: { id }, data: { deletedAt: new Date() } });
    await logAudit("ARCHIVE", id, {}, session?.user.id);
    revalidatePath("/employees");
    return { id };
  });
}

export async function restoreEmployee(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();
  return withPermission(session, "MANAGE_EMPLOYEES", async () => {
    await prisma.employee.update({ where: { id }, data: { deletedAt: null } });
    await logAudit("RESTORE", id, {}, session?.user.id);
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
    const type = String(formData.get("type") ?? "OTHER");

    if (!(file instanceof File) || file.size === 0) throw new Error("Choose a file to upload.");
    if (!title) throw new Error("Give the document a title.");

    const asset = await uploadToCloudinary(file, "siko-mendo/documents", { resourceType: "auto", access: "authenticated" });

    const document = await prisma.document.create({
      data: {
        title,
        type: type as never,
        fileUrl: asset.url,
        fileKey: asset.publicId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
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
    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document) throw new Error("Document not found.");

    await prisma.document.update({ where: { id: documentId }, data: { deletedAt: new Date() } });
    const resourceType = document.mimeType.startsWith("image/") ? "image" : "raw";
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
    const rows = parseEmployeeCsv(text);
    if (rows.length === 0) throw new Error("CSV is empty or has no data rows.");

    const results = await importEmployeeRows(rows);
    const createdCount = results.filter((r) => r.status === "created").length;
    const errorCount = results.filter((r) => r.status === "error").length;

    revalidatePath("/employees");
    return { results, createdCount, errorCount };
  });
}
