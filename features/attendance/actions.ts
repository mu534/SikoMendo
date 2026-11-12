"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import {
  attendanceEntrySchema,
  attendanceFormDataToObject,
  combineDateAndTime,
} from "./schemas";
import { parseDateOnly } from "@/lib/attendance-date";
import { routeCheckInToSession, isWorkingDay } from "@/lib/attendance-policy";
import { getAttendancePolicy } from "./policy-queries";
import { isHolidayDate } from "./calendar-queries";

// ── Shared: working-day + holiday guard ───────────────────────────────────

async function assertAttendanceDateAllowed(
  dateStr: string,
  policy: Awaited<ReturnType<typeof getAttendancePolicy>>
): Promise<void> {
  if (!isWorkingDay(dateStr, policy)) {
    const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const d = new Date(`${dateStr}T00:00:00.000Z`);
    const dow = d.getUTCDay();
    const dayName = DAY_NAMES[dow === 0 ? 7 : dow] ?? "this day";
    throw new Error(
      `${dateStr} is a ${dayName} — a non-working day per the attendance policy. ` +
      "Adjust working days in Attendance Policy or use the absence correction form for exceptional cases."
    );
  }
  const holiday = await isHolidayDate(dateStr);
  if (holiday) {
    throw new Error(
      `${dateStr} is a configured holiday. Remove it from the Attendance Calendar first if attendance is required on this date.`
    );
  }
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
 * Session is server-derived from routeCheckInToSession when a check-in time
 * is present; otherwise defaults to form-supplied session (or MORNING).
 * The admin retains the ability to set status manually (this is a manual
 * record path, not an automatic check-in path).
 *
 * Authorization: requires MANAGE_ATTENDANCE, which is granted ONLY to ADMIN.
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

    const { employeeId, date, status, checkIn, checkOut, notes, session: formSession } =
      parsed.data;

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
    if (MANUAL_RECORDABLE_STATUSES.has(status)) {
      const onLeave = await isOnApprovedLeave(employeeId, dateValue);
      if (onLeave) {
        throw new Error(
          `This employee is on approved leave on ${date}. Cancel the approved leave request first before recording a different attendance status.`
        );
      }
    }

    // Block on non-working days and holidays
    const policy = await getAttendancePolicy();
    await assertAttendanceDateAllowed(date, policy);

    // combineDateAndTime interprets time as EAT (UTC+3) — fixed in schemas.ts
    const checkInValue  = combineDateAndTime(date, checkIn);
    const checkOutValue = combineDateAndTime(date, checkOut);

    // Derive session: server-side from check-in time when available; otherwise
    // use form-supplied session (defaults to MORNING for status-only entries).
    let attendanceSession: "MORNING" | "AFTERNOON";
    if (checkInValue) {
      attendanceSession = routeCheckInToSession(checkInValue, policy);
    } else {
      attendanceSession = (formSession ?? "MORNING") as "MORNING" | "AFTERNOON";
    }

    const record = await prisma.attendance.upsert({
      where: {
        employeeId_date_session: {
          employeeId,
          date:    dateValue,
          session: attendanceSession,
        },
      },
      create: {
        employeeId,
        date:        dateValue,
        session:     attendanceSession,
        status,
        checkIn:     checkInValue,
        checkOut:    checkOutValue,
        notes,
        recordedById: session?.user.id,
      },
      update: {
        status,
        checkIn:     checkInValue,
        checkOut:    checkOutValue,
        notes,
        recordedById: session?.user.id,
      },
    });

    await logAudit(
      "UPSERT",
      "Attendance",
      record.id,
      { employeeId, date, session: attendanceSession, status },
      session?.user.id
    );
    revalidatePath("/attendance");
    return { id: record.id };
  });
}

// ── Bulk mark present (ADMIN ONLY) ────────────────────────────────────────

/**
 * Admin-only: marks every unmarked employee for the given date as PRESENT.
 * Creates PRESENT rows for BOTH sessions for each eligible (active, not-on-leave)
 * employee who has no row for (date, session), so a single button press covers
 * the full day under the two-session model.
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

    // Block bulk-mark on non-working days and holidays
    const policy = await getAttendancePolicy();
    await assertAttendanceDateAllowed(date, policy);

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

    // Find existing rows for the date across both sessions
    const existing = await prisma.attendance.findMany({
      where: { date: dateValue, employeeId: { in: eligibleIds } },
      select: { employeeId: true, session: true },
    });

    // Build set of (employeeId, session) that already exist
    const alreadyMarked = new Set(
      existing.map((e: { employeeId: string; session: string }) => `${e.employeeId}:${e.session}`)
    );

    // Create PRESENT rows for each (eligible employee, session) that doesn't yet exist
    const toCreate: Array<{
      employeeId: string;
      date: Date;
      session: "MORNING" | "AFTERNOON";
      status: "PRESENT";
      recordedById: string | undefined;
    }> = [];

    for (const empId of eligibleIds) {
      for (const sess of ["MORNING", "AFTERNOON"] as const) {
        if (!alreadyMarked.has(`${empId}:${sess}`)) {
          toCreate.push({
            employeeId:  empId,
            date:        dateValue,
            session:     sess,
            status:      "PRESENT",
            recordedById: session?.user.id,
          });
        }
      }
    }

    if (toCreate.length > 0) {
      await prisma.attendance.createMany({ data: toCreate });
      await logAudit(
        "BULK_MARK_PRESENT",
        "Attendance",
        date,
        { count: toCreate.length },
        session?.user.id
      );
    }

    revalidatePath("/attendance");
    return { count: toCreate.length };
  });
}
