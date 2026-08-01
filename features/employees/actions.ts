"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { uploadToCloudinary, deleteFromCloudinary } from "@/lib/cloudinary";
import { employeeSchema, employeeFormDataToObject } from "./schemas";
import { generateNextEmployeeId } from "./queries";
import { parseEmployeeCsv, importEmployeeRows, type ImportRowResult } from "./bulk-import";
import { usernameFromEmployeeId, generateTempPassword } from "@/lib/credentials";
import { createNotification } from "@/lib/notifications";

/** Employment statuses that mean someone is no longer actively working here. */
const INACTIVE_STATUSES = new Set(["RESIGNED", "RETIRED", "TERMINATED", "SUSPENDED", "INACTIVE"]);

/**
 * Bans or unbans the User account linked to an employee, so a login can't
 * outlive the employment record it belongs to. Never touches the acting
 * admin's own account, and silently no-ops if there's no linked account.
 */
async function setLinkedAccountBanStatus(
  employeeUserId: string | null,
  banned: boolean,
  reason: string,
  actingUserId?: string
) {
  if (!employeeUserId || employeeUserId === actingUserId) return;

  if (banned) {
    await auth.api.banUser({ headers: await headers(), body: { userId: employeeUserId } });
    await prisma.user.update({ where: { id: employeeUserId }, data: { banReason: reason } });
  } else {
    await auth.api.unbanUser({ headers: await headers(), body: { userId: employeeUserId } });
  }
}

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
): Promise<ActionResult<{ id: string; credentials?: { username: string; password: string } }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_EMPLOYEES", async () => {
    const parsed = employeeSchema.safeParse(employeeFormDataToObject(formData));
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }

    if (parsed.data.userId) {
      const takenBy = await prisma.employee.findUnique({ where: { userId: parsed.data.userId } });
      if (takenBy) throw new Error("That user account is already linked to another employee.");
    }

    if (parsed.data.email) {
      const duplicate = await prisma.employee.findFirst({
        where: { email: parsed.data.email, deletedAt: null },
      });
      if (duplicate) {
        throw new Error(
          `An active employee with this email already exists: ${duplicate.firstName} ${duplicate.lastName} (${duplicate.employeeId}).`
        );
      }
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

    // Auto-provision a login account, unless HR/Admin explicitly opted out on the form.
    const shouldCreateLogin = formData.get("createLogin") === "on" && !parsed.data.userId;
    let credentials: { username: string; password: string } | undefined;

    if (shouldCreateLogin) {
      const username = usernameFromEmployeeId(employeeId);
      const password = generateTempPassword();
      const internalEmail = `${username}@internal.sikomendo.local`;

      const { user } = await auth.api.createUser({
        headers: await headers(),
        body: {
          name: `${employee.firstName} ${employee.lastName}`,
          email: internalEmail,
          password,
        },
      });

      await prisma.user.update({
        where: { id: user.id },
        data: {
          username,
          displayUsername: username,
          role: "EMPLOYEE",
          mustChangePassword: true,
        },
      });

      await prisma.employee.update({ where: { id: employee.id }, data: { userId: user.id } });

      await logAudit("CREATE", user.id, { username, source: "employee_auto_provision" }, session?.user.id);

      await createNotification(
        user.id,
        "ACCOUNT_CREATED",
        "Welcome to Siko Mendo HRMIS",
        `Your account has been created. Sign in with username "${username}" and the temporary password provided by HR — you'll be asked to set a new password on first login.`
      );

      credentials = { username, password };
    }

    revalidatePath("/employees");
    return { id: employee.id, credentials };
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

    if (parsed.data.userId && parsed.data.userId !== existing.userId) {
      const takenBy = await prisma.employee.findUnique({ where: { userId: parsed.data.userId } });
      if (takenBy && takenBy.id !== id) {
        throw new Error("That user account is already linked to another employee.");
      }
    }

    if (parsed.data.email && parsed.data.email !== existing.email) {
      const duplicate = await prisma.employee.findFirst({
        where: { email: parsed.data.email, deletedAt: null, id: { not: id } },
      });
      if (duplicate) {
        throw new Error(
          `An active employee with this email already exists: ${duplicate.firstName} ${duplicate.lastName} (${duplicate.employeeId}).`
        );
      }
    }

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

    const wasInactive = INACTIVE_STATUSES.has(existing.employmentStatus);
    const isInactive = INACTIVE_STATUSES.has(parsed.data.employmentStatus);
    if (isInactive && !wasInactive) {
      await setLinkedAccountBanStatus(
        parsed.data.userId,
        true,
        `Employment status set to ${parsed.data.employmentStatus}.`,
        session?.user.id
      );
    } else if (!isInactive && wasInactive) {
      await setLinkedAccountBanStatus(parsed.data.userId, false, "", session?.user.id);
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
    const employee = await prisma.employee.update({ where: { id }, data: { deletedAt: new Date() } });
    await setLinkedAccountBanStatus(employee.userId, true, "Employee record archived.", session?.user.id);
    await logAudit("ARCHIVE", id, {}, session?.user.id);
    revalidatePath("/employees");
    return { id };
  });
}

export async function restoreEmployee(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();
  return withPermission(session, "MANAGE_EMPLOYEES", async () => {
    const employee = await prisma.employee.update({ where: { id }, data: { deletedAt: null } });
    // Only lift the ban if their employment status doesn't still say they're inactive —
    // restoring the record shouldn't override a still-current TERMINATED/RESIGNED status.
    if (!INACTIVE_STATUSES.has(employee.employmentStatus)) {
      await setLinkedAccountBanStatus(employee.userId, false, "", session?.user.id);
    }
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

// ── Bulk import employees from CSV ──────────────────────────────────────────

export async function bulkImportEmployees(
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ results: ImportRowResult[]; createdCount: number; errorCount: number }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_EMPLOYEES", async () => {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("Please choose a CSV file to upload.");
    }

    const text = await file.text();
    const { rows, parseErrors } = parseEmployeeCsv(text);

    if (parseErrors.length > 0) {
      throw new Error(parseErrors[0]);
    }
    if (rows.length === 0) {
      throw new Error("The CSV file has no data rows.");
    }
    if (rows.length > 500) {
      throw new Error("Please import 500 rows or fewer at a time.");
    }

    const results = await importEmployeeRows(rows, session!.user.id);
    const createdCount = results.filter((r) => r.status === "created").length;
    const errorCount = results.length - createdCount;

    revalidatePath("/employees");
    return { results, createdCount, errorCount };
  });
}
