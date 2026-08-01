"use server";

import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { strongPasswordSchema } from "@/lib/credentials";
import { z } from "zod";

const forceChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Your temporary password is required"),
    newPassword: strongPasswordSchema,
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: "Your new password must be different from the temporary one",
    path: ["newPassword"],
  });

export async function forceChangePassword(
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<null>> {
  const session = await getServerSession();

  return withPermission(session, "UPDATE_OWN_INFO", async () => {
    const parsed = forceChangePasswordSchema.safeParse({
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

    await prisma.user.update({
      where: { id: session!.user.id },
      data: { mustChangePassword: false, passwordChangedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        action: "PASSWORD_CHANGED",
        entity: "User",
        entityId: session!.user.id,
        changes: { firstLogin: true },
        userId: session!.user.id,
      },
    });

    return null;
  });
}
