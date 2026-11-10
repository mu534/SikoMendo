"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { uploadToCloudinary, deleteFromCloudinary } from "@/lib/cloudinary";
import { validatePhotoFile, PHOTO_ALLOWED_MIME_TYPES, PHOTO_MAX_BYTES } from "@/lib/file-limits";

// ── Schemas ───────────────────────────────────────────────────────────────────

const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  middleName: z.string().trim().min(1, "Father's name is required"),
  lastName: z.string().trim().min(1, "Grandfather's name is required"),
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const updateEmployeeInfoSchema = z.object({
  phone: z.string().trim().optional().transform((v) => v || null),
  email: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : null))
    .pipe(z.string().email("Enter a valid email").nullable()),
  address: z.string().trim().optional().transform((v) => v || null),
  emergencyContactName: z.string().trim().optional().transform((v) => v || null),
  emergencyContactPhone: z.string().trim().optional().transform((v) => v || null),
  emergencyContactRelationship: z.string().trim().optional().transform((v) => v || null),
  emergencyContactAddress: z.string().trim().optional().transform((v) => v || null),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPhotoFile(formData: FormData): File | null {
  const file = formData.get("photo");
  return file instanceof File && file.size > 0 ? file : null;
}

// ── Actions ───────────────────────────────────────────────────────────────────

export async function updateOwnProfile(
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ name: string; image: string | null }>> {
  const session = await getServerSession();

  return withPermission(session, "UPDATE_OWN_INFO", async () => {
    const parsed = updateProfileSchema.safeParse({
      firstName: formData.get("firstName"),
      middleName: formData.get("middleName"),
      lastName: formData.get("lastName"),
    });
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");

    const fullName = [parsed.data.firstName, parsed.data.middleName, parsed.data.lastName]
      .filter(Boolean)
      .join(" ");

    const photo = getPhotoFile(formData);
    const asset = photo
      ? await uploadToCloudinary(photo, "siko-mendo/profile", { resourceType: "image" })
      : null;

    await auth.api.adminUpdateUser({
      headers: await headers(),
      body: {
        userId: session!.user.id,
        data: asset ? { name: fullName, image: asset.url } : { name: fullName },
      },
    });

    // Update the linked employee record's name fields if one exists
    const linkedEmployee = await prisma.employee.findUnique({
      where: { userId: session!.user.id },
      select: { id: true },
    });
    if (linkedEmployee) {
      await prisma.employee.update({
        where: { id: linkedEmployee.id },
        data: {
          firstName: parsed.data.firstName,
          middleName: parsed.data.middleName || null,
          lastName: parsed.data.lastName,
        },
      });
    }

    await logAudit("UPDATE_PROFILE", "User", session!.user.id, { name: fullName, photoChanged: Boolean(asset) }, session!.user.id);

    revalidatePath("/profile");
    return { name: fullName, image: asset?.url ?? null };
  });
}

/**
 * Lets an employee update their own contact and emergency contact info
 * on their linked employee record. Only touches safe fields — no role,
 * status, or employment changes are possible through this action.
 */
export async function updateOwnEmployeeInfo(
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ image: string | null }>> {
  const session = await getServerSession();

  return withPermission(session, "UPDATE_OWN_INFO", async () => {
    // Find the employee record linked to the current user
    const employee = await prisma.employee.findUnique({
      where: { userId: session!.user.id },
      select: { id: true, profileImageKey: true },
    });

    if (!employee) {
      throw new Error("No employee record is linked to your account.");
    }

    const parsed = updateEmployeeInfoSchema.safeParse({
      phone: formData.get("phone"),
      email: formData.get("email"),
      address: formData.get("address"),
      emergencyContactName: formData.get("emergencyContactName"),
      emergencyContactPhone: formData.get("emergencyContactPhone"),
      emergencyContactRelationship: formData.get("emergencyContactRelationship"),
      emergencyContactAddress: formData.get("emergencyContactAddress"),
    });
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");

    const photo = getPhotoFile(formData);
    const asset = photo
      ? await uploadToCloudinary(photo, "siko-mendo/employees", { resourceType: "image" })
      : null;

    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        ...parsed.data,
        ...(asset ? { profileImageUrl: asset.url, profileImageKey: asset.publicId } : {}),
      },
    });

    // Sync the new photo to user.image so the header avatar, account summary
    // card, and anywhere else that reads session.user.image stays up to date.
    if (asset) {
      await auth.api.adminUpdateUser({
        headers: await headers(),
        body: { userId: session!.user.id, data: { image: asset.url } },
      });
    }

    await logAudit("UPDATE_OWN_INFO", "Employee", employee.id, { ...parsed.data, photoChanged: Boolean(asset) }, session!.user.id);

    revalidatePath("/profile");
    return { image: asset?.url ?? null };
  });
}

export async function changeOwnPassword(
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<null>> {
  const session = await getServerSession();

  return withPermission(session, "UPDATE_OWN_INFO", async () => {
    const parsed = changePasswordSchema.safeParse({
      currentPassword: formData.get("currentPassword"),
      newPassword: formData.get("newPassword"),
      confirmPassword: formData.get("confirmPassword"),
    });
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");

    await auth.api.changePassword({
      headers: await headers(),
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        revokeOtherSessions: false,
      },
    });

    // Record when the password was last changed and clear any pending
    // force-change flag (e.g. if the user got here via the profile page
    // instead of the dedicated force-change flow).
    await prisma.user.update({
      where: { id: session!.user.id },
      data: { mustChangePassword: false, passwordChangedAt: new Date() },
    });

    await logAudit("PASSWORD_CHANGED", "User", session!.user.id, { selfService: true }, session!.user.id);

    return null;
  });
}

// ── Profile picture management ─────────────────────────────────────────────────

/**
 * Uploads and replaces the authenticated user's profile picture.
 *
 * Flow:
 *  1. Validate auth + permission.
 *  2. Validate the image blob (MIME, size).
 *  3. Upload to Cloudinary with a 512×512 fill transformation.
 *  4. Update user.image + user.imagePublicId in the DB.
 *  5. Sync to Better Auth + linked Employee record.
 *  6. Delete the OLD Cloudinary asset (non-fatal).
 *  7. Revalidate relevant paths.
 *
 * Admin role may supply an optional `targetUserId` in formData to manage
 * another user's picture.  Any other role is restricted to self-updates.
 */
export async function updateProfilePicture(
  formData: FormData
): Promise<ActionResult<{ imageUrl: string }>> {
  const session = await getServerSession();

  return withPermission(session, "UPDATE_OWN_INFO", async () => {
    const selfId = session!.user.id;
    const rawTargetId = formData.get("targetUserId");
    const targetUserId =
      typeof rawTargetId === "string" && rawTargetId.trim()
        ? rawTargetId.trim()
        : selfId;

    // Only ADMIN may update other users
    if (targetUserId !== selfId && session!.user.role !== "ADMIN") {
      throw new Error("You don't have permission to update another user's profile picture.");
    }

    // ── Validate image ────────────────────────────────────────────────────────
    const imageField = formData.get("image");
    if (!(imageField instanceof Blob)) {
      throw new Error("No image provided.");
    }

    // Convert to File for the existing validator
    const mimeType =
      imageField instanceof File
        ? imageField.type
        : (imageField as Blob).type || "image/jpeg";

    if (!PHOTO_ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new Error("Only JPEG, PNG, and WebP images are accepted.");
    }
    if (imageField.size > PHOTO_MAX_BYTES) {
      throw new Error("File size must be under 5 MB.");
    }

    // ── Read current publicId for cleanup ─────────────────────────────────────
    const currentUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { imagePublicId: true },
    });
    const oldPublicId = currentUser?.imagePublicId ?? null;

    // ── Upload to Cloudinary ──────────────────────────────────────────────────
    const buffer = Buffer.from(await imageField.arrayBuffer());
    const asset = await uploadToCloudinary(buffer, "siko-mendo/profile-pictures", {
      resourceType: "image",
      mimeType,
      transformation: [
        { width: 512, height: 512, crop: "fill", gravity: "face", quality: "auto", fetch_format: "auto" },
      ],
    });

    // ── DB update ─────────────────────────────────────────────────────────────
    try {
      await prisma.user.update({
        where: { id: targetUserId },
        data: {
          image: asset.url,
          imagePublicId: asset.publicId,
          updatedAt: new Date(),
        },
      });
    } catch (dbErr) {
      // Rollback: delete the just-uploaded asset so we don't orphan it
      await deleteFromCloudinary(asset.publicId);
      throw dbErr;
    }

    // ── Sync to Better Auth ───────────────────────────────────────────────────
    try {
      await auth.api.adminUpdateUser({
        headers: await headers(),
        body: { userId: targetUserId, data: { image: asset.url } },
      });
    } catch {
      // Non-fatal: DB is source of truth; auth session refreshes on next request
    }

    // ── Sync to linked Employee record ────────────────────────────────────────
    try {
      const linkedEmployee = await prisma.employee.findUnique({
        where: { userId: targetUserId },
        select: { id: true },
      });
      if (linkedEmployee) {
        await prisma.employee.update({
          where: { id: linkedEmployee.id },
          data: {
            profileImageUrl: asset.url,
            profileImageKey: asset.publicId,
          },
        });
      }
    } catch {
      // Non-fatal
    }

    // ── Delete old Cloudinary asset ───────────────────────────────────────────
    if (oldPublicId) {
      await deleteFromCloudinary(oldPublicId);
    }

    // ── Audit + revalidate ────────────────────────────────────────────────────
    await logAudit("UPDATE_PROFILE", "User", targetUserId, { photoChanged: true }, selfId);

    revalidatePath("/profile");
    revalidatePath("/employees");
    revalidatePath("/users");

    return { imageUrl: asset.url };
  });
}

/**
 * Removes the authenticated user's profile picture.
 *
 * Flow:
 *  1. Validate auth + permission.
 *  2. Read current image + publicId from DB.
 *  3. Clear image + imagePublicId in the DB (and linked Employee).
 *  4. Sync to Better Auth.
 *  5. Delete Cloudinary asset (non-fatal).
 *  6. Revalidate paths.
 */
export async function removeProfilePicture(): Promise<ActionResult<null>> {
  const session = await getServerSession();

  return withPermission(session, "UPDATE_OWN_INFO", async () => {
    const userId = session!.user.id;

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { imagePublicId: true },
    });
    const oldPublicId = currentUser?.imagePublicId ?? null;

    // ── Clear DB ──────────────────────────────────────────────────────────────
    await prisma.user.update({
      where: { id: userId },
      data: {
        image: null,
        imagePublicId: null,
        updatedAt: new Date(),
      },
    });

    // ── Sync to Better Auth ───────────────────────────────────────────────────
    try {
      await auth.api.adminUpdateUser({
        headers: await headers(),
        body: { userId, data: { image: null } },
      });
    } catch {
      // Non-fatal
    }

    // ── Sync to linked Employee ───────────────────────────────────────────────
    try {
      const linkedEmployee = await prisma.employee.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (linkedEmployee) {
        await prisma.employee.update({
          where: { id: linkedEmployee.id },
          data: { profileImageUrl: null, profileImageKey: null },
        });
      }
    } catch {
      // Non-fatal
    }

    // ── Delete old Cloudinary asset ───────────────────────────────────────────
    if (oldPublicId) {
      await deleteFromCloudinary(oldPublicId);
    }

    // ── Audit + revalidate ────────────────────────────────────────────────────
    await logAudit("UPDATE_PROFILE", "User", userId, { photoRemoved: true }, userId);

    revalidatePath("/profile");
    revalidatePath("/employees");
    revalidatePath("/users");

    return null;
  });
}
