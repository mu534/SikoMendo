"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const updateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").trim(),
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

export async function updateOwnProfile(
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ name: string }>> {
  const session = await getServerSession();

  return withPermission(session, "UPDATE_OWN_INFO", async () => {
    const parsed = updateProfileSchema.safeParse({ name: formData.get("name") });
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");

    await auth.api.adminUpdateUser({
      headers: await headers(),
      body: { userId: session!.user.id, data: { name: parsed.data.name } },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE_PROFILE",
        entity: "User",
        entityId: session!.user.id,
        changes: { name: parsed.data.name },
        userId: session!.user.id,
      },
    });

    revalidatePath("/profile");
    return { name: parsed.data.name };
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
