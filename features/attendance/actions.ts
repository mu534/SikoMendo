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

/**
 * Returns true when the employee has an approved leave request that covers
 * the given date. Used to block manual attendance entry on leave days.
 */
async function isOnApprovedLeave(employeeId: string, date: Date): Promise<boolean> {
  const leave = await prisma.leaveRequest.findFirst({
    where: {
      employeeId,
      status: "APPROVED",
      startDate: { lte: date },
      endDate:   { gte: date },
    },
    select: { id: true },
  });
  return leave !== null;
}

/**
 * The statuses a user is allowed to manually record.
 * ON_LEAVE is only set automatically when leave is approved — never manually.
 */
const MANUAL_RECORDABLE_STATUSES = new Set([
  "PRESENT",
  "ABSENT",
  "LATE",
  "HALF_DAY",
  "EXCUSED",
]);

export async function upsertAttendance(
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_ATTENDANCE", async () => {
    const parsed = attendanceEntrySchema.safeParse(attendanceFormDataToObject(formData));
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }

    const { employeeId, date, status, checkIn, checkOut, notes } = parsed.data;

    // Reject attendance for archived employees
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { deletedAt: true },
    });
    if (!employee) throw new Error("Employee not found.");
    if (employee.deletedAt !== null) {
      throw new Error("Cannot record attendance for an archived employee.");
    }

    const dateValue = parseDateOnly(date);

    // Prevent recording Present/Absent/Late/etc. for an employee on approved leave.
    // If you need to override leave (e.g. employee came back early), cancel the
    // leave request first, which removes the ON_LEAVE attendance record.
    if (MANUAL_RECORDABLE_STATUSES.has(status)) {
      const onLeave = await isOnApprovedLeave(employeeId, dateValue);
      if (onLeave) {
        throw new Error(
          `This employee is on approved leave on ${date}. Cancel the approved leave request first before recording a different attendance status.`
        );
      }
    }

    const checkInValue  = combineDateAndTime(date, checkIn);
    const checkOutValue = combineDateAndTime(date, checkOut);

    const record = await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId, date: dateValue } },
      create: {
        employeeId,
        date: dateValue,
        status,
        checkIn:    checkInValue,
        checkOut:   checkOutValue,
        notes,
        recordedById: session?.user.id,
      },
      update: {
        status,
        checkIn:    checkInValue,
        checkOut:   checkOutValue,
        notes,
        recordedById: session?.user.id,
      },
    });

    await logAudit("UPSERT", record.id, { employeeId, date, status }, session?.user.id);
    revalidatePath("/attendance");
    return { id: record.id };
  });
}

/** Marks every employee with no record yet for the given date as PRESENT.
 *  Skips archived employees and employees on approved leave. */
export async function markUnmarkedPresent(
  date: string,
  employeeIds: string[]
): Promise<ActionResult<{ count: number }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_ATTENDANCE", async () => {
    const dateValue = parseDateOnly(date);

    // Drop archived employees
    const activeEmployees = await prisma.employee.findMany({
      where: { id: { in: employeeIds }, deletedAt: null },
      select: { id: true },
    });
    const activeIds = activeEmployees.map((e: { id: string }) => e.id);

    // Drop employees who are on approved leave on this date — their
    // ON_LEAVE record was already created when the leave was approved.
    const onLeaveEmployees = await prisma.leaveRequest.findMany({
      where: {
        employeeId: { in: activeIds },
        status:    "APPROVED",
        startDate: { lte: dateValue },
        endDate:   { gte: dateValue },
      },
      select: { employeeId: true },
    });
    const onLeaveIds = new Set(onLeaveEmployees.map((l: { employeeId: string }) => l.employeeId));

    const eligibleIds = activeIds.filter((id) => !onLeaveIds.has(id));

    if (eligibleIds.length === 0) {
      return { count: 0 };
    }

    const existing = await prisma.attendance.findMany({
      where: { date: dateValue, employeeId: { in: eligibleIds } },
      select: { employeeId: true },
    });
    const alreadyMarked = new Set(existing.map((e: { employeeId: string }) => e.employeeId));
    const toMark = eligibleIds.filter((id) => !alreadyMarked.has(id));

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
