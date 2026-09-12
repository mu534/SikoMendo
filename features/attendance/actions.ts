"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { attendanceEntrySchema, attendanceFormDataToObject, combineDateAndTime } from "./schemas";
import { parseDateOnly } from "@/lib/attendance-date";

// ── Audit helper ───────────────────────────────────────────────────────────

async function logAudit(action: string, entityId: string, changes: unknown, userId?: string) {
  await prisma.auditLog.create({
    data: { action, entity: "Attendance", entityId, changes: changes as object, userId },
  });
}

// ── Shared: approved-leave check ──────────────────────────────────────────

/**
 * Returns true when the employee has an approved leave request covering `date`.
 * Used to block administrative attendance entry on approved leave days.
 */
async function isOnApprovedLeave(employeeId: string, date: Date): Promise<boolean> {
  const leave = await prisma.leaveRequest.findFirst({
    where: {
      employeeId,
      status: "APPROVED",
      startDate: { lte: date },
      endDate: { gte: date },
    },
    select: { id: true },
  });
  return leave !== null;
}

/**
 * The statuses an Admin can manually record for another employee.
 * ON_LEAVE is only set automatically when leave is approved — never manually.
 */
const MANUAL_RECORDABLE_STATUSES = new Set([
  "PRESENT",
  "ABSENT",
  "LATE",
  "HALF_DAY",
  "EXCUSED",
]);

// ── Administrative attendance upsert (ADMIN ONLY) ─────────────────────────

/**
 * Admin-only: create or update any employee's attendance record for any date.
 *
 * Authorization: requires MANAGE_ATTENDANCE, which is granted ONLY to ADMIN.
 *   - HR Officers and Managers use selfCheckIn/selfCheckOut in self-actions.ts.
 *   - Employees use selfCheckIn/selfCheckOut in self-actions.ts.
 *
 * The employeeId and date here ARE accepted from the form because this is an
 * administrative action performed by an Admin on behalf of any employee.
 * Self-attendance actions (self-actions.ts) NEVER accept these from the client.
 */
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

    // Prevent recording non-ON_LEAVE status for an employee on approved leave.
    // Cancel the leave request first if you need to override it.
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

// ── Bulk mark present (ADMIN ONLY) ────────────────────────────────────────

/**
 * Admin-only: marks every unmarked employee for the given date as PRESENT.
 * Skips archived employees and employees on approved leave.
 *
 * Authorization: requires MANAGE_ATTENDANCE (ADMIN only).
 */
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

    // Drop employees on approved leave — their ON_LEAVE record was created at approval time
    const onLeaveEmployees = await prisma.leaveRequest.findMany({
      where: {
        employeeId: { in: activeIds },
        status: "APPROVED",
        startDate: { lte: dateValue },
        endDate: { gte: dateValue },
      },
      select: { employeeId: true },
    });
    const onLeaveIds = new Set(onLeaveEmployees.map((l: { employeeId: string }) => l.employeeId));
    const eligibleIds = activeIds.filter((id) => !onLeaveIds.has(id));

    if (eligibleIds.length === 0) return { count: 0 };

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
