"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { uploadToCloudinary, deleteFromCloudinary } from "@/lib/cloudinary";
import { employeeSchema, employeeFormDataToObject } from "./schemas";
import { generateNextEmployeeId } from "./queries";

async function logAudit(
  action: string,
  entityId: string,
  changes: unknown,
  userId?: string
) {
  await prisma.auditLog.create({
    data: { action, entity: "Employee", entityId, changes: changes as object, userId },
  });
}

function getPhotoFile(formData: FormData): File | null {
  const file = formData.get("photo");
  return file instanceof File && file.size > 0 ? file : null;
}

// ── Create ────────────────────────────────────────────────────────────────────
// Creates the employee record only. System account (username/password) is
// provisioned separately by an Admin in the Users module.

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
        ...parsed.data,
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

    const photo = getPhotoFile(formData);
    const asset = photo
      ? await uploadToCloudinary(photo, "siko-mendo/employees", { resourceType: "image" })
      : null;

    // Build a before/after diff for the audit log
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(parsed.data)) {
      const prev = (existing as Record<string, unknown>)[key];
      const prevStr = prev instanceof Date ? prev.toISOString() : String(prev ?? "");
      const currStr = val instanceof Date ? val.toISOString() : String(val ?? "");
      if (prevStr !== currStr) {
        before[key] = prev;
        after[key] = val;
      }
    }

    await prisma.employee.update({
      where: { id },
      data: {
        ...parsed.data,
        ...(asset ? { profileImageUrl: asset.url, profileImageKey: asset.publicId } : {}),
      },
    });

    if (asset && existing.profileImageKey) {
      await deleteFromCloudinary(existing.profileImageKey);
    }

    await logAudit(
      "UPDATE",
      id,
      { before, after, updatedBy: session?.user.name },
      session?.user.id
    );

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

    const asset = await uploadToCloudinary(file, "siko-mendo/documents", { resourceType: "auto" });

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
