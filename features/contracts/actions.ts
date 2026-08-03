"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { contractSchema, contractFormDataToObject } from "./schemas";

async function logAudit(action: string, entityId: string, changes: unknown, userId?: string) {
  await prisma.auditLog.create({
    data: { action, entity: "Contract", entityId, changes: changes as object, userId },
  });
}

export async function createContract(
  employeeId: string,
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_CONTRACTS", async () => {
    const parsed = contractSchema.safeParse(contractFormDataToObject(formData));
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new Error("Employee not found.");

    const startDate = new Date(`${parsed.data.startDate}T00:00:00.000Z`);
    const endDate = parsed.data.endDate ? new Date(`${parsed.data.endDate}T00:00:00.000Z`) : null;

    const previousActive = await prisma.contract.findFirst({
      where: { employeeId, status: "ACTIVE" },
    });

    const [contract] = await prisma.$transaction([
      prisma.contract.create({
        data: {
          employeeId,
          contractType: parsed.data.contractType,
          startDate,
          endDate,
          remarks: parsed.data.remarks,
          status: "ACTIVE",
        },
      }),
      ...(previousActive
        ? [prisma.contract.update({ where: { id: previousActive.id }, data: { status: "RENEWED" as const } })]
        : []),
    ]);

    await logAudit(
      "CREATE",
      contract.id,
      { contractType: parsed.data.contractType, startDate: parsed.data.startDate },
      session?.user.id
    );

    revalidatePath(`/employees/${employeeId}`);
    return { id: contract.id };
  });
}

export async function terminateContract(
  contractId: string,
  employeeId: string
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_CONTRACTS", async () => {
    const contract = await prisma.contract.findUnique({ where: { id: contractId } });
    if (!contract) throw new Error("Contract not found.");
    if (contract.status !== "ACTIVE") throw new Error("Only an active contract can be terminated.");

    await prisma.contract.update({
      where: { id: contractId },
      data: { status: "TERMINATED", endDate: contract.endDate ?? new Date() },
    });

    await logAudit("TERMINATE", contractId, {}, session?.user.id);

    revalidatePath(`/employees/${employeeId}`);
    return { id: contractId };
  });
}
