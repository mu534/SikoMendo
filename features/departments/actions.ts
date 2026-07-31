"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { departmentUpdateSchema, departmentFormDataToObject } from "./schemas";

async function logAudit(action: string, entityId: string, changes: unknown, userId?: string) {
  await prisma.auditLog.create({
    data: { action, entity: "Department", entityId, changes: changes as object, userId },
  });
}

// Department names are fixed (seeded once, reflecting the Union's official
// structure) — there is deliberately no createDepartment action. Admins can
// only edit description/status, never create new departments through the app.

export async function updateDepartment(
  id: string,
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_DEPARTMENTS", async () => {
    const parsed = departmentUpdateSchema.safeParse(departmentFormDataToObject(formData));
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }

    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing) throw new Error("Department not found.");

    await prisma.department.update({ where: { id }, data: parsed.data });
    await logAudit("UPDATE", id, parsed.data, session?.user.id);

    revalidatePath("/departments");
    revalidatePath(`/departments/${id}`);
    return { id };
  });
}

export async function setDepartmentActive(id: string, isActive: boolean): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_DEPARTMENTS", async () => {
    await prisma.department.update({ where: { id }, data: { isActive } });
    await logAudit(isActive ? "ACTIVATE" : "DEACTIVATE", id, { isActive }, session?.user.id);

    revalidatePath("/departments");
    revalidatePath(`/departments/${id}`);
    return { id };
  });
}
