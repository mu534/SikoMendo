"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { positionSchema, positionFormDataToObject } from "./schemas";

async function logAudit(action: string, entityId: string, changes: unknown, userId?: string) {
  await prisma.auditLog.create({
    data: { action, entity: "Position", entityId, changes: changes as object, userId },
  });
}

async function assertNameNotTakenInDepartment(departmentId: string, name: string, excludeId?: string) {
  const existing = await prisma.position.findFirst({
    where: {
      departmentId,
      name: { equals: name, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  if (existing) {
    throw new Error(`A position named "${existing.name}" already exists in this department.`);
  }
}

export async function createPosition(
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_POSITIONS", async () => {
    const parsed = positionSchema.safeParse(positionFormDataToObject(formData));
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }

    const department = await prisma.department.findUnique({ where: { id: parsed.data.departmentId } });
    if (!department) throw new Error("Department not found.");

    await assertNameNotTakenInDepartment(parsed.data.departmentId, parsed.data.name);

    const position = await prisma.position.create({ data: parsed.data });
    await logAudit("CREATE", position.id, { name: position.name, department: department.name }, session?.user.id);

    revalidatePath(`/departments/${parsed.data.departmentId}`);
    return { id: position.id };
  });
}

export async function updatePosition(
  id: string,
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_POSITIONS", async () => {
    const parsed = positionSchema.safeParse(positionFormDataToObject(formData));
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }

    const existing = await prisma.position.findUnique({ where: { id } });
    if (!existing) throw new Error("Position not found.");

    await assertNameNotTakenInDepartment(parsed.data.departmentId, parsed.data.name, id);

    await prisma.position.update({ where: { id }, data: parsed.data });
    await logAudit("UPDATE", id, parsed.data, session?.user.id);

    revalidatePath(`/departments/${parsed.data.departmentId}`);
    return { id };
  });
}

export async function setPositionActive(
  id: string,
  departmentId: string,
  isActive: boolean
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_POSITIONS", async () => {
    await prisma.position.update({ where: { id }, data: { isActive } });
    await logAudit(isActive ? "ACTIVATE" : "DEACTIVATE", id, { isActive }, session?.user.id);

    revalidatePath(`/departments/${departmentId}`);
    return { id };
  });
}
