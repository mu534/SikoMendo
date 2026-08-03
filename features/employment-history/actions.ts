"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { employmentChangeSchema, employmentChangeFormDataToObject } from "./schemas";

function dayBefore(date: Date): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

export async function recordEmploymentChange(
  employeeId: string,
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_EMPLOYMENT_HISTORY", async () => {
    const parsed = employmentChangeSchema.safeParse(employmentChangeFormDataToObject(formData));
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new Error("Employee not found.");

    const effectiveDate = new Date(`${parsed.data.effectiveDate}T00:00:00.000Z`);

    const currentActive = await prisma.employmentHistory.findFirst({
      where: { employeeId, endDate: null },
      orderBy: { effectiveDate: "desc" },
    });

    if (currentActive && effectiveDate <= currentActive.effectiveDate) {
      throw new Error("The effective date must be after the current employment record's effective date.");
    }

    const [historyRecord] = await prisma.$transaction([
      prisma.employmentHistory.create({
        data: {
          employeeId,
          departmentId: parsed.data.departmentId,
          positionId: parsed.data.positionId,
          employmentType: parsed.data.employmentType,
          effectiveDate,
          changeReason: parsed.data.changeReason,
          remarks: parsed.data.remarks,
        },
      }),
      ...(currentActive
        ? [
            prisma.employmentHistory.update({
              where: { id: currentActive.id },
              data: { endDate: dayBefore(effectiveDate) },
            }),
          ]
        : []),
      prisma.employee.update({
        where: { id: employeeId },
        data: {
          departmentId: parsed.data.departmentId,
          positionId: parsed.data.positionId,
          employmentType: parsed.data.employmentType,
        },
      }),
    ]);

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "EmploymentHistory",
        entityId: historyRecord.id,
        changes: {
          departmentId: parsed.data.departmentId,
          positionId: parsed.data.positionId,
          employmentType: parsed.data.employmentType,
          effectiveDate: parsed.data.effectiveDate,
          changeReason: parsed.data.changeReason,
        },
        userId: session?.user.id,
      },
    });

    revalidatePath(`/employees/${employeeId}`);
    return { id: historyRecord.id };
  });
}
