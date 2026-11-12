"use server";

/**
 * Admin-only attendance actions for recording attendance on behalf of another
 * employee. These actions:
 *   - Require MANAGE_ATTENDANCE (ADMIN only).
 *   - Determine attendance status using the active policy — the admin does NOT
 *     manually choose PRESENT/LATE/etc.
 *   - Generate timestamps on the server — the admin cannot inject arbitrary times.
 *   - Produce audit log entries that clearly identify the Admin as the actor,
 *     separate from the employee self-attendance audit trail.
 *
 * Session routing (adminCheckIn): session is server-derived from the check-in
 * timestamp via routeCheckInToSession — the admin cannot force a session mismatch.
 *
 * Admin check-out: keyed by attendanceId (the specific session row) with
 * employeeId/date ownership validation for defense in depth.
 */

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { getOrgLocalDateString, parseDateOnly, getServerNow } from "@/lib/attendance-date";
import {
  routeCheckInToSession,
  evaluateSessionCheckIn,
  isWorkingDay,
} from "@/lib/attendance-policy";
import { getAttendancePolicy } from "./policy-queries";
import { isHolidayDate } from "./calendar-queries";

// ── Shared: working-day + holiday guard ───────────────────────────────────

/**
 * Throws a descriptive error when `dateStr` is a non-working weekday (per
 * policy) or a configured holiday (per AttendanceCalendar).
 * Admin-specific message — does not block absence corrections or check-outs.
 */
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
      "Adjust the working days in Attendance Policy if this date should be counted, " +
      "or use the absence correction form for an exceptional case."
    );
  }

  const holiday = await isHolidayDate(dateStr);
  if (holiday) {
    throw new Error(
      `${dateStr} is a configured holiday. No attendance records should be created on holidays. ` +
      "Remove the holiday from the Attendance Calendar first if attendance is required on this date."
    );
  }
}

// ── Shared audit helper ────────────────────────────────────────────────────

async function logAdminAudit(
  action: string,
  entityId: string,
  changes: unknown,
  adminUserId: string
) {
  await logAudit(action, "Attendance", entityId, changes, adminUserId);
}

// ── Helpers ────────────────────────────────────────────────────────────────

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
 * Combines a "YYYY-MM-DD" date string with an optional "HH:MM" time string
 * to produce a UTC Date object. If no time is given, returns the current
 * server time. The resulting Date is treated as org-local (EAT = UTC+3)
 * and converted to UTC for storage.
 *
 * combineDateAndTime interprets time as UTC not EAT — pre-existing behaviour,
 * tracked separately.
 */
function buildTimestamp(dateStr: string, timeStr: string | null): Date {
  if (!timeStr) return getServerNow();
  // Treat the "HH:MM" as org-local (EAT = UTC+3) → subtract 3h for UTC
  const [h, m] = timeStr.split(":").map(Number);
  const orgLocalMs =
    new Date(`${dateStr}T00:00:00.000Z`).getTime() +
    (h ?? 0) * 60 * 60 * 1000 +
    (m ?? 0) * 60 * 1000;
  const utcMs = orgLocalMs - 3 * 60 * 60 * 1000; // EAT → UTC
  return new Date(utcMs);
}

// ── adminCheckIn ────────────────────────────────────────────────────────────

/**
 * Admin records a check-in for another employee.
 *
 * Session is server-derived from routeCheckInToSession(checkInTs, policy) —
 * the admin cannot specify or override the session directly.
 *
 * formData fields:
 *   employeeId  – the target employee's internal DB id (trusted because ADMIN)
 *   date        – optional "YYYY-MM-DD"; defaults to today
 *   checkInTime – optional "HH:MM" org-local; defaults to current server time
 *   notes       – optional remarks
 */
export async function adminCheckIn(
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string; status: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_ATTENDANCE", async () => {
    const employeeId = String(formData.get("employeeId") ?? "").trim();
    const dateInput  =
      String(formData.get("date") ?? "").trim() || getOrgLocalDateString();
    const timeInput  = String(formData.get("checkInTime") ?? "").trim() || null;
    const notes      = String(formData.get("notes") ?? "").trim() || null;

    if (!employeeId) throw new Error("Employee ID is required.");

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      throw new Error("Invalid date format. Use YYYY-MM-DD.");
    }

    // Verify employee exists and is not archived
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeId: true,
        deletedAt: true,
      },
    });
    if (!employee) throw new Error("Employee not found.");
    if (employee.deletedAt !== null) {
      throw new Error("Cannot record attendance for an archived employee.");
    }

    const dateValue = parseDateOnly(dateInput);

    // Block if on approved leave
    const onLeave = await isOnApprovedLeave(employeeId, dateValue);
    if (onLeave) {
      throw new Error(
        `${employee.firstName} ${employee.lastName} is on approved leave on ${dateInput}. ` +
          "Cancel the leave request first to record attendance."
      );
    }

    // Build check-in timestamp (admin can supply an override time)
    const checkInTs = buildTimestamp(dateInput, timeInput);

    // Validate override time is not in the future relative to now
    if (checkInTs > getServerNow()) {
      throw new Error("Check-in time cannot be in the future.");
    }

    // Server-derive session from the check-in timestamp
    const policy   = await getAttendancePolicy();

    // Block on non-working days and holidays
    await assertAttendanceDateAllowed(dateInput, policy);
    const attendanceSession = routeCheckInToSession(checkInTs, policy);

    // Check for existing row for (employeeId, date, session)
    const existing = await prisma.attendance.findUnique({
      where: {
        employeeId_date_session: {
          employeeId,
          date: dateValue,
          session: attendanceSession,
        },
      },
      select: { id: true, checkIn: true, autoRecorded: true },
    });

    if (existing?.checkIn !== null && existing?.checkIn !== undefined) {
      throw new Error(
        `${employee.firstName} ${employee.lastName} already has a check-in for the ${attendanceSession.toLowerCase()} session on ${dateInput}.`
      );
    }

    // Policy-based status calculation — Admin does NOT manually pick status
    const status = evaluateSessionCheckIn(checkInTs, policy, attendanceSession);

    let record;
    if (existing) {
      // Update existing auto-ABSENT row in place
      record = await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          checkIn:      checkInTs,
          status,
          notes,
          autoRecorded: false,
          recordedById: session!.user.id,
        },
        select: { id: true },
      });
    } else {
      record = await prisma.attendance.create({
        data: {
          employeeId,
          date:        dateValue,
          session:     attendanceSession,
          status,
          checkIn:     checkInTs,
          notes,
          recordedById: session!.user.id,
        },
        select: { id: true },
      });
    }

    // Audit entry clearly identifies Admin as actor, not the employee
    await logAdminAudit(
      "ADMIN_CHECK_IN",
      record.id,
      {
        targetEmployeeId:   employeeId,
        targetEmployeeCode: employee.employeeId,
        targetEmployeeName: `${employee.firstName} ${employee.lastName}`,
        date:               dateInput,
        session:            attendanceSession,
        checkIn:            checkInTs.toISOString(),
        status,
        recordedByAdmin:    session!.user.id,
        notes,
      },
      session!.user.id
    );

    revalidatePath("/attendance");
    revalidatePath("/attendance/management");
    return { id: record.id, status };
  });
}

// ── adminCheckOut ───────────────────────────────────────────────────────────

/**
 * Admin records a check-out for another employee.
 *
 * Keyed by attendanceId (the specific session row) so there is no ambiguity
 * now that two rows per employee/day exist. employeeId and date are validated
 * for ownership/defense in depth.
 *
 * formData fields:
 *   attendanceId – the specific Attendance row id (required)
 *   employeeId   – target employee DB id (for ownership validation)
 *   date         – "YYYY-MM-DD" (for ownership validation)
 *   checkOutTime – optional "HH:MM" org-local; defaults to current server time
 *   notes        – optional remarks
 */
export async function adminCheckOut(
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_ATTENDANCE", async () => {
    const attendanceId = String(formData.get("attendanceId") ?? "").trim();
    const employeeId   = String(formData.get("employeeId") ?? "").trim();
    const dateInput    =
      String(formData.get("date") ?? "").trim() || getOrgLocalDateString();
    const timeInput    = String(formData.get("checkOutTime") ?? "").trim() || null;
    const notes        = String(formData.get("notes") ?? "").trim() || null;

    if (!attendanceId) throw new Error("Attendance record ID is required.");
    if (!employeeId)   throw new Error("Employee ID is required.");

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      throw new Error("Invalid date format. Use YYYY-MM-DD.");
    }

    // Load row by id for ownership validation
    const existing = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      select: {
        id: true,
        employeeId: true,
        date: true,
        session: true,
        checkIn: true,
        checkOut: true,
        employee: {
          select: { firstName: true, lastName: true, employeeId: true, deletedAt: true },
        },
      },
    });

    if (!existing) throw new Error("Attendance record not found.");

    // Ownership validation
    if (existing.employeeId !== employeeId) {
      throw new Error("Attendance record does not belong to the specified employee.");
    }
    const rowDateStr = existing.date.toISOString().slice(0, 10);
    if (rowDateStr !== dateInput) {
      throw new Error("Attendance record date does not match the supplied date.");
    }
    if (existing.employee.deletedAt !== null) {
      throw new Error("Cannot record attendance for an archived employee.");
    }

    if (existing.checkIn === null) {
      throw new Error(
        `${existing.employee.firstName} ${existing.employee.lastName} has no check-in for the ${existing.session.toLowerCase()} session on ${dateInput}. Check in first.`
      );
    }
    if (existing.checkOut !== null) {
      throw new Error(
        `${existing.employee.firstName} ${existing.employee.lastName} already has a check-out for the ${existing.session.toLowerCase()} session on ${dateInput}.`
      );
    }

    const checkOutTs = buildTimestamp(dateInput, timeInput);

    if (checkOutTs > getServerNow()) {
      throw new Error("Check-out time cannot be in the future.");
    }

    if (checkOutTs <= existing.checkIn) {
      throw new Error("Check-out time must be after check-in time.");
    }

    const record = await prisma.attendance.update({
      where: { id: existing.id },
      data:  {
        checkOut:    checkOutTs,
        recordedById: session!.user.id,
        ...(notes ? { notes } : {}),
      },
      select: { id: true },
    });

    await logAdminAudit(
      "ADMIN_CHECK_OUT",
      record.id,
      {
        targetEmployeeId:   employeeId,
        targetEmployeeCode: existing.employee.employeeId,
        targetEmployeeName: `${existing.employee.firstName} ${existing.employee.lastName}`,
        date:               dateInput,
        session:            existing.session,
        checkIn:            existing.checkIn.toISOString(),
        checkOut:           checkOutTs.toISOString(),
        recordedByAdmin:    session!.user.id,
        notes,
      },
      session!.user.id
    );

    revalidatePath("/attendance");
    revalidatePath("/attendance/management");
    return { id: record.id };
  });
}

// ── correctAbsenceRecord ─────────────────────────────────────────────────────

/**
 * ADMIN ONLY — correct an automatically-recorded absence when the employee
 * genuinely attended but forgot to check in.
 *
 * Session is read from the existing row — never accepted from the client.
 * Status is recomputed via evaluateSessionCheckIn using the row's session.
 *
 * formData fields:
 *   attendanceId  – the Attendance row id to correct
 *   checkInTime   – "HH:MM" org-local time (required — cannot correct without a time)
 *   checkOutTime  – "HH:MM" org-local time (optional)
 *   correctionNote – free-text reason for the correction (required, min 5 chars)
 *
 * Rules enforced:
 *   - Only operates on rows where autoRecorded=true (rejects manual records)
 *   - Recalculates status via evaluateSessionCheckIn so Admin cannot manually set status
 *   - Sets autoRecorded=false, correctedById, correctionNote
 *   - Writes an AuditLog entry with action='ABSENCE_CORRECTION'
 *   - Never deletes or silently overwrites history
 */
export async function correctAbsenceRecord(
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string; status: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_ATTENDANCE", async () => {
    const attendanceId   = String(formData.get("attendanceId") ?? "").trim();
    const checkInTime    = String(formData.get("checkInTime") ?? "").trim() || null;
    const checkOutTime   = String(formData.get("checkOutTime") ?? "").trim() || null;
    const correctionNote = String(formData.get("correctionNote") ?? "").trim();

    if (!attendanceId) throw new Error("Attendance record ID is required.");
    if (!checkInTime)  throw new Error("Check-in time is required to correct an absence.");
    if (correctionNote.length < 5) {
      throw new Error("Correction note must be at least 5 characters.");
    }

    // Validate time formats
    if (!/^\d{2}:\d{2}$/.test(checkInTime)) {
      throw new Error("Check-in time must be in HH:MM format.");
    }
    if (checkOutTime && !/^\d{2}:\d{2}$/.test(checkOutTime)) {
      throw new Error("Check-out time must be in HH:MM format.");
    }

    // Load the existing record
    const existing = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      select: {
        id: true,
        employeeId: true,
        date: true,
        session: true,
        status: true,
        autoRecorded: true,
        checkIn: true,
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeId: true,
          },
        },
      },
    });

    if (!existing) throw new Error("Attendance record not found.");
    if (!existing.autoRecorded) {
      throw new Error(
        "This record was not auto-recorded. Use the standard check-in form to make corrections."
      );
    }

    // Derive the date string from the stored @db.Date (midnight UTC)
    const dateStr = existing.date.toISOString().slice(0, 10);

    // Build timestamps (org-local EAT → UTC)
    const checkInTs  = buildTimestamp(dateStr, checkInTime);
    const checkOutTs = checkOutTime ? buildTimestamp(dateStr, checkOutTime) : null;

    // Validate times are not in the future
    const now = getServerNow();
    if (checkInTs > now)  throw new Error("Check-in time cannot be in the future.");
    if (checkOutTs && checkOutTs > now)   throw new Error("Check-out time cannot be in the future.");
    if (checkOutTs && checkOutTs <= checkInTs) {
      throw new Error("Check-out time must be after check-in time.");
    }

    // Recalculate status using the row's own session — Admin cannot manually pick it.
    // Session is read from the existing row (server-trusted), never from client input.
    const policy    = await getAttendancePolicy();
    const newStatus = evaluateSessionCheckIn(checkInTs, policy, existing.session as "MORNING" | "AFTERNOON");

    const updated = await prisma.attendance.update({
      where: { id: attendanceId },
      data:  {
        checkIn:        checkInTs,
        checkOut:       checkOutTs ?? undefined,
        status:         newStatus,
        autoRecorded:   false,
        correctedById:  session!.user.id,
        correctionNote,
        recordedById:   session!.user.id,
      },
      select: { id: true, status: true },
    });

    await logAdminAudit(
      "ABSENCE_CORRECTION",
      attendanceId,
      {
        targetEmployeeId:   existing.employeeId,
        targetEmployeeCode: existing.employee.employeeId,
        targetEmployeeName: `${existing.employee.firstName} ${existing.employee.lastName}`,
        date:               dateStr,
        session:            existing.session,
        before: { status: existing.status, autoRecorded: true, checkIn: null },
        after:  {
          status:      newStatus,
          autoRecorded: false,
          checkIn:     checkInTs.toISOString(),
          checkOut:    checkOutTs?.toISOString() ?? null,
        },
        correctionNote,
        correctedByAdmin: session!.user.id,
      },
      session!.user.id
    );

    revalidatePath("/attendance");
    revalidatePath("/attendance/management");
    return { id: updated.id, status: updated.status };
  });
}
