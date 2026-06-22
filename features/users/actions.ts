"use server";

import prisma from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import * as bcrypt from "bcryptjs";
import { createUserSchema, updateUserSchema, type CreateUserInput, type UpdateUserInput } from "./schemas";

export async function createUser(input: CreateUserInput): Promise<ActionResult<{ id: string; email: string }>> {
  const session = await getSessionFromRequest();

  return withPermission(session, "MANAGE_USERS", async () => {
    const validated = createUserSchema.parse(input);

    const existingUser = await prisma.user.findUnique({ where: { email: validated.email } });
    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(validated.password, salt);

    const user = await prisma.user.create({
      data: {
        name: validated.name,
        email: validated.email,
        role: validated.role as any,
        emailVerified: true,
        accounts: {
          create: {
            providerId: "email",
            accountId: validated.email,
            password: passwordHash,
          },
        },
      },
    });

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "User",
        entityId: user.id,
        changes: { name: user.name, email: user.email, role: user.role },
        userId: session?.user?.id,
      },
    });

    return { id: user.id, email: user.email };
  });
}

export async function updateUser(
  userId: string,
  input: UpdateUserInput
): Promise<ActionResult<{ id: string; email: string }>> {
  const session = await getSessionFromRequest();

  return withPermission(session, "MANAGE_USERS", async () => {
    const validated = updateUserSchema.parse(input);

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(validated.name && { name: validated.name }),
        ...(validated.email && { email: validated.email }),
        ...(validated.role && { role: validated.role as any }),
        ...(validated.banned !== undefined && { banned: validated.banned }),
      },
    });

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "User",
        entityId: user.id,
        changes: validated,
        userId: session?.user?.id,
      },
    });

    return { id: user.id, email: user.email };
  });
}

export async function deleteUser(userId: string): Promise<ActionResult<{ success: boolean }>> {
  const session = await getSessionFromRequest();

  return withPermission(session, "MANAGE_USERS", async () => {
    await prisma.user.delete({ where: { id: userId } });

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "User",
        entityId: userId,
        userId: session?.user?.id,
      },
    });

    return { success: true };
  });
}
