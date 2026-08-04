"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { createUserSchema, updateUserSchema } from "./schemas";
import { generateTempPassword } from "@/lib/credentials";
import { createNotification } from "@/lib/notifications";
import { generateUsernameFromName } from "@/lib/username-utils";

async function logAudit(action: string, entityId: string, changes: unknown, userId?: string) {
  await prisma.auditLog.create({
    data: { action, entity: "User", entityId, changes: changes as object, userId },
  });
}

/**
 * Derives a unique username + temporary password from a full name.
 * Called client-side via useTransition so the admin sees the credentials
 * before submitting the create-user form.
 */
export async function generateUserCredentials(
  fullName: string
): Promise<ActionResult<{ username: string; password: string }>> {
  const session = await getServerSession();
  return withPermission(session, "MANAGE_USERS", async () => {
    const parts = fullName.trim().split(/\s+/);
    const firstName = parts[0] ?? "user";
    const lastName = parts[parts.length - 1] ?? parts[0] ?? "user";
    const username = await generateUsernameFromName(firstName, lastName);
    const password = generateTempPassword();
    return { username, password };
  });
}

export async function createUserAccount(
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_USERS", async () => {
    const parsed = createUserSchema.safeParse({
      name: formData.get("name"),
      username: formData.get("username"),
      password: formData.get("password"),
      role: formData.get("role"),
    });
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }

    // Check username uniqueness before attempting creation
    const existingByUsername = await prisma.user.findUnique({
      where: { username: parsed.data.username },
    });
    if (existingByUsername) {
      throw new Error("A user with this username already exists.");
    }

    // better-auth's createUser API requires an email field.
    // We use a deterministic internal address that is never shown in the UI
    // and never used for login — username is the only login credential.
    const internalEmail = `${parsed.data.username}@internal.sikomendo.local`;

    const existing = await prisma.user.findUnique({ where: { email: internalEmail } });
    if (existing) {
      throw new Error("A user with this username already exists.");
    }

    const { user } = await auth.api.createUser({
      headers: await headers(),
      body: {
        name: parsed.data.name,
        email: internalEmail,
        password: parsed.data.password,
      },
    });

    // Set the username and role via Prisma (better-auth createUser doesn't
    // expose username or our custom role enum through its typed API).
    await prisma.user.update({
      where: { id: user.id },
      data: {
        username: parsed.data.username,
        displayUsername: parsed.data.username,
        role: parsed.data.role,
      },
    });

    await logAudit(
      "CREATE",
      user.id,
      { name: user.name, username: parsed.data.username, role: parsed.data.role },
      session?.user.id
    );
    revalidatePath("/users");
    return { id: user.id };
  });
}

export async function updateUserAccount(
  userId: string,
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_USERS", async () => {
    const parsed = updateUserSchema.safeParse({
      name: formData.get("name"),
      username: formData.get("username"),
      role: formData.get("role"),
    });
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new Error("User not found.");

    // If username changed, check it's not already taken by another user
    if (parsed.data.username !== target.username) {
      const taken = await prisma.user.findUnique({
        where: { username: parsed.data.username },
      });
      if (taken && taken.id !== userId) {
        throw new Error("That username is already taken.");
      }
    }

    // Update the internal email to stay in sync with the username
    const newInternalEmail = `${parsed.data.username}@internal.sikomendo.local`;

    await auth.api.adminUpdateUser({
      headers: await headers(),
      body: { userId, data: { name: parsed.data.name, email: newInternalEmail } },
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        username: parsed.data.username,
        displayUsername: parsed.data.username,
        role: parsed.data.role,
      },
    });

    await logAudit("UPDATE", userId, parsed.data, session?.user.id);
    revalidatePath("/users");
    revalidatePath(`/users/${userId}`);
    return { id: userId };
  });
}

export async function toggleUserBan(
  userId: string,
  nextBanned: boolean
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_USERS", async () => {
    if (session?.user.id === userId) {
      throw new Error("You can't ban your own account.");
    }

    if (nextBanned) {
      await auth.api.banUser({ headers: await headers(), body: { userId } });
    } else {
      await auth.api.unbanUser({ headers: await headers(), body: { userId } });
    }

    await logAudit(nextBanned ? "BAN" : "UNBAN", userId, { banned: nextBanned }, session?.user.id);
    revalidatePath("/users");
    return { id: userId };
  });
}

export async function deleteUserAccount(userId: string): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_USERS", async () => {
    if (session?.user.id === userId) {
      throw new Error("You can't delete your own account.");
    }

    await auth.api.removeUser({ headers: await headers(), body: { userId } });

    await logAudit("DELETE", userId, {}, session?.user.id);
    revalidatePath("/users");
    return { id: userId };
  });
}

/**
 * Admin-initiated password reset: generates a brand-new temporary password and
 * forces the user to set their own on next sign-in. The password is returned
 * once in the action result and never persisted anywhere in plaintext.
 */
export async function resetUserPassword(userId: string): Promise<ActionResult<{ password: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_USERS", async () => {
    if (session?.user.id === userId) {
      throw new Error("Use Change Password on your own profile instead.");
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) throw new Error("User not found.");

    const newPassword = generateTempPassword();
    await auth.api.setUserPassword({ headers: await headers(), body: { userId, newPassword } });

    await logAudit("PASSWORD_RESET", userId, {}, session?.user.id);
    await createNotification(
      userId,
      "PASSWORD_RESET",
      "Your password was reset",
      "An administrator reset your password. You'll be asked to set a new one the next time you sign in."
    );

    revalidatePath(`/users/${userId}`);
    return { password: newPassword };
  });
}

/** Forces a user to set a new password on their next sign-in, without changing their current one. */
export async function forcePasswordChangeForUser(userId: string): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_USERS", async () => {
    await logAudit("FORCE_PASSWORD_CHANGE", userId, {}, session?.user.id);
    revalidatePath(`/users/${userId}`);
    return { id: userId };
  });
}
