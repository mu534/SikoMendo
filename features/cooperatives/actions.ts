"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { cooperativeSchema, cooperativeFormDataToObject, validateCertificateFile } from "./schemas";
import { generateNextCooperativeId } from "./queries";
import { uploadToCloudinary, deleteFromCloudinary, getSignedFileUrl } from "@/lib/cloudinary";

async function logAudit(action: string, entityId: string, changes: unknown, userId?: string) {
  await prisma.auditLog.create({
    data: { action, entity: "Cooperative", entityId, changes: changes as object, userId },
  });
}

export async function createCooperative(
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_COOPERATIVES", async () => {
    const parsed = cooperativeSchema.safeParse(cooperativeFormDataToObject(formData));
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }

    // ── Legal certificate (required on create) ─────────────────────────────
    const certFile = formData.get("legalCertificate");
    if (!certFile || !(certFile instanceof File) || certFile.size === 0) {
      throw new Error("Legal certificate is required when registering a new cooperative.");
    }
    const certError = validateCertificateFile(certFile);
    if (certError) throw new Error(certError);

    const asset = await uploadToCloudinary(certFile, "siko-mendo/cooperatives/certificates", {
      resourceType: "auto",
      access: "authenticated",
    });

    const cooperativeId = await generateNextCooperativeId();
    const cooperative = await prisma.cooperative.create({
      data: {
        cooperativeId,
        ...parsed.data,
        legalCertificateKey: asset.publicId,
        legalCertificateUrl: asset.url,
        legalCertificateResourceType: asset.resourceType,
        legalCertificateFileName: certFile.name,
        legalCertificateFileSize: certFile.size,
      },
    });

    await logAudit(
      "CREATE",
      cooperative.id,
      { cooperativeId, name: cooperative.name, legalCertificateKey: asset.publicId },
      session?.user.id
    );
    revalidatePath("/cooperatives");
    return { id: cooperative.id };
  });
}

export async function updateCooperative(
  id: string,
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_COOPERATIVES", async () => {
    const parsed = cooperativeSchema.safeParse(cooperativeFormDataToObject(formData));
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }

    const existing = await prisma.cooperative.findUnique({ where: { id } });
    if (!existing) throw new Error("Cooperative not found.");

    await prisma.cooperative.update({ where: { id }, data: parsed.data });

    await logAudit("UPDATE", id, parsed.data, session?.user.id);
    revalidatePath("/cooperatives");
    revalidatePath(`/cooperatives/${id}`);
    return { id };
  });
}

export async function uploadCooperativeCertificate(
  id: string,
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_COOPERATIVES", async () => {
    const existing = await prisma.cooperative.findUnique({ where: { id } });
    if (!existing) throw new Error("Cooperative not found.");

    const certFile = formData.get("legalCertificate");
    if (!certFile || !(certFile instanceof File) || certFile.size === 0) {
      throw new Error("No file provided.");
    }
    const certError = validateCertificateFile(certFile);
    if (certError) throw new Error(certError);

    // Upload new certificate first — data integrity: don't delete old one
    // until the new upload succeeds.
    const asset = await uploadToCloudinary(certFile, "siko-mendo/cooperatives/certificates", {
      resourceType: "auto",
      access: "authenticated",
    });

    // Save the new reference before cleaning up the old asset.
    const oldKey = existing.legalCertificateKey;
    const oldType = (existing.legalCertificateResourceType ?? "raw") as "image" | "raw";

    await prisma.cooperative.update({
      where: { id },
      data: {
        legalCertificateKey: asset.publicId,
        legalCertificateUrl: asset.url,
        legalCertificateResourceType: asset.resourceType,
        legalCertificateFileName: certFile.name,
        legalCertificateFileSize: certFile.size,
      },
    });

    // Best-effort cleanup of the old Cloudinary asset (non-fatal).
    if (oldKey) {
      await deleteFromCloudinary(oldKey, oldType);
    }

    await logAudit(
      "UPLOAD_CERTIFICATE",
      id,
      { legalCertificateKey: asset.publicId, replaced: oldKey ?? null },
      session?.user.id
    );
    revalidatePath(`/cooperatives/${id}`);
    return { id };
  });
}

export async function getCooperativeCertificateUrl(
  id: string
): Promise<ActionResult<{ url: string }>> {
  const session = await getServerSession();

  return withPermission(session, "VIEW_COOPERATIVES", async () => {
    const coop = await prisma.cooperative.findUnique({
      where: { id },
      select: {
        legalCertificateKey: true,
        legalCertificateResourceType: true,
      },
    });
    if (!coop) throw new Error("Cooperative not found.");
    if (!coop.legalCertificateKey) throw new Error("No legal certificate uploaded.");

    const resourceType = (coop.legalCertificateResourceType ?? "raw") as "image" | "raw";
    const url = getSignedFileUrl(coop.legalCertificateKey, resourceType);
    return { url };
  });
}

export async function archiveCooperative(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_COOPERATIVES", async () => {
    await prisma.cooperative.update({ where: { id }, data: { deletedAt: new Date() } });
    await logAudit("ARCHIVE", id, {}, session?.user.id);
    revalidatePath("/cooperatives");
    return { id };
  });
}

export async function restoreCooperative(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_COOPERATIVES", async () => {
    await prisma.cooperative.update({ where: { id }, data: { deletedAt: null } });
    await logAudit("RESTORE", id, {}, session?.user.id);
    revalidatePath("/cooperatives");
    return { id };
  });
}
