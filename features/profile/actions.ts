"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { uploadToCloudinary } from "@/lib/cloudinary";

const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  middleName: z.string().trim().optional(),
  lastName: z.string().trim().min(1, "Last name is required"),
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

function getPhotoFile(formData: FormData): File | null {
  const file = formData.get("photo");
  return file instanceof File && file.size > 0 ? file : null;
}

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

    // `name`/`image` are core better-auth fields — route through its admin API so the
    // active session stays in sync. firstName/middleName/lastName aren't known to
    // better-auth, so those are written directly via Prisma.
    await auth.api.adminUpdateUser({
      headers: await headers(),
      body: {
        userId: session!.user.id,
        data: asset ? { name: fullName, image: asset.url } : { name: fullName },
      },
    });

    await prisma.user.update({
      where: { id: session!.user.id },
      data: {
        firstName: parsed.data.firstName,
        middleName: parsed.data.middleName || null,
        lastName: parsed.data.lastName,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE_PROFILE",
        entity: "User",
        entityId: session!.user.id,
        changes: { name: fullName, photoChanged: Boolean(asset) },
        userId: session!.user.id,
      },
    });

    revalidatePath("/profile");
    return { name: fullName, image: asset?.url ?? null };
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

    return null;
  });
}