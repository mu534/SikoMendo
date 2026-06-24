"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { createUserSchema, updateUserSchema } from "./schemas";

async function logAudit(action: string, entityId: string, changes: unknown, userId?: string) {
  await prisma.auditLog.create({
    data: { action, entity: "User", entityId, changes: changes as object, userId },
  });
}

export async function createUserAccount(_prevState: unknown, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_USERS", async () => {
    const parsed = createUserSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      role: formData.get("role"),
    });
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      throw new Error("A user with this email already exists.");
    }

    const { user } = await auth.api.createUser({
      headers: await headers(),
      body: {
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
      },
    });

    // The admin plugin's TypeScript types only know about its own
    // adminRoles/defaultRole strings, so we set our 4-way Role enum
    // directly through Prisma instead of fighting its generics.
    await prisma.user.update({ where: { id: user.id }, data: { role: parsed.data.role } });

    await logAudit("CREATE", user.id, { name: user.name, email: user.email, role: parsed.data.role }, session?.user.id);
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
      email: formData.get("email"),
      role: formData.get("role"),
    });
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new Error("User not found.");

    await auth.api.adminUpdateUser({
      headers: await headers(),
      body: { userId, data: { name: parsed.data.name, email: parsed.data.email } },
    });

    if (parsed.data.role !== target.role) {
      await prisma.user.update({ where: { id: userId }, data: { role: parsed.data.role } });
    }

    await logAudit("UPDATE", userId, parsed.data, session?.user.id);
    revalidatePath("/users");
    revalidatePath(`/users/${userId}`);
    return { id: userId };
  });
}

export async function toggleUserBan(userId: string, nextBanned: boolean): Promise<ActionResult<{ id: string }>> {
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
