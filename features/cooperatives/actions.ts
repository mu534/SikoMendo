"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { cooperativeSchema, cooperativeFormDataToObject } from "./schemas";
import { generateNextCooperativeId } from "./queries";

async function logAudit(action: string, entityId: string, changes: unknown, userId?: string) {
  await prisma.auditLog.create({
    data: { action, entity: "Cooperative", entityId, changes: changes as object, userId },
  });
}

export async function createCooperative(_prevState: unknown, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_COOPERATIVES", async () => {
    const parsed = cooperativeSchema.safeParse(cooperativeFormDataToObject(formData));
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }

    const cooperativeId = await generateNextCooperativeId();
    const cooperative = await prisma.cooperative.create({
      data: { cooperativeId, ...parsed.data },
    });

    await logAudit("CREATE", cooperative.id, { cooperativeId, name: cooperative.name }, session?.user.id);
    revalidatePath("/cooperatives");
    return { id: cooperative.id };
  });
}

export async function updateCooperative(
  id: string,
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_COOPERATIVES", async () => {
    const parsed = cooperativeSchema.safeParse(cooperativeFormDataToObject(formData));
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }

    const existing = await prisma.cooperative.findUnique({ where: { id } });
    if (!existing) throw new Error("Cooperative not found.");

    await prisma.cooperative.update({ where: { id }, data: parsed.data });

    await logAudit("UPDATE", id, parsed.data, session?.user.id);
    revalidatePath("/cooperatives");
    revalidatePath(`/cooperatives/${id}`);
    return { id };
  });
}

export async function archiveCooperative(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_COOPERATIVES", async () => {
    const activeEmployeeCount = await prisma.employee.count({
      where: { cooperativeId: id, deletedAt: null },
    });

    if (activeEmployeeCount > 0) {
      throw new Error(
        `This cooperative still has ${activeEmployeeCount} employee${activeEmployeeCount === 1 ? "" : "s"} assigned. Reassign or archive them first.`
      );
    }

    await prisma.cooperative.update({ where: { id }, data: { deletedAt: new Date() } });
    await logAudit("ARCHIVE", id, {}, session?.user.id);
    revalidatePath("/cooperatives");
    return { id };
  });
}

export async function restoreCooperative(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_COOPERATIVES", async () => {
    await prisma.cooperative.update({ where: { id }, data: { deletedAt: null } });
    await logAudit("RESTORE", id, {}, session?.user.id);
    revalidatePath("/cooperatives");
    return { id };
  });
}
