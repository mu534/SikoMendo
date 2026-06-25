"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { attendanceEntrySchema, attendanceFormDataToObject, combineDateAndTime } from "./schemas";
import { parseDateOnly } from "./queries";

async function logAudit(action: string, entityId: string, changes: unknown, userId?: string) {
  await prisma.auditLog.create({
    data: { action, entity: "Attendance", entityId, changes: changes as object, userId },
  });
}

export async function upsertAttendance(_prevState: unknown, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_ATTENDANCE", async () => {
    const parsed = attendanceEntrySchema.safeParse(attendanceFormDataToObject(formData));
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }

    const { employeeId, date, status, checkIn, checkOut, notes } = parsed.data;
    const dateValue = parseDateOnly(date);
    const checkInValue = combineDateAndTime(date, checkIn);
    const checkOutValue = combineDateAndTime(date, checkOut);

    const record = await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId, date: dateValue } },
      create: {
        employeeId,
        date: dateValue,
        status,
        checkIn: checkInValue,
        checkOut: checkOutValue,
        notes,
        recordedById: session?.user.id,
      },
      update: {
        status,
        checkIn: checkInValue,
        checkOut: checkOutValue,
        notes,
        recordedById: session?.user.id,
      },
    });

    await logAudit("UPSERT", record.id, { employeeId, date, status }, session?.user.id);
    revalidatePath("/attendance");
    return { id: record.id };
  });
}

/** Marks every employee with no record yet for the given date as PRESENT. */
export async function markUnmarkedPresent(date: string, employeeIds: string[]): Promise<ActionResult<{ count: number }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_ATTENDANCE", async () => {
    const dateValue = parseDateOnly(date);

    const existing = await prisma.attendance.findMany({
      where: { date: dateValue, employeeId: { in: employeeIds } },
      select: { employeeId: true },
    });
    const alreadyMarked = new Set(existing.map((e: { employeeId: string }) => e.employeeId));
    const toMark = employeeIds.filter((id) => !alreadyMarked.has(id));

    if (toMark.length > 0) {
      await prisma.attendance.createMany({
        data: toMark.map((employeeId) => ({
          employeeId,
          date: dateValue,
          status: "PRESENT" as const,
          recordedById: session?.user.id,
        })),
      });
      await logAudit("BULK_MARK_PRESENT", date, { count: toMark.length }, session?.user.id);
    }

    revalidatePath("/attendance");
    return { count: toMark.length };
  });
}
