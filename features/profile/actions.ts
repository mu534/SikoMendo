"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { uploadToCloudinary } from "@/lib/cloudinary";

// ── Schemas ───────────────────────────────────────────────────────────────────

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

/**
 * Lets an employee update their own contact and emergency contact info
 * on their linked employee record. Only touches safe fields — no role,
 * status, or employment changes are possible through this action.
 */
export async function updateOwnEmployeeInfo(
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<null>> {
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

    await prisma.auditLog.create({
      data: {
        action: "UPDATE_OWN_INFO",
        entity: "Employee",
        entityId: employee.id,
        changes: { ...parsed.data, photoChanged: Boolean(asset) },
        userId: session!.user.id,
      },
    });

    revalidatePath("/profile");
    return null;
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
