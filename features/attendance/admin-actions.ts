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
 * The admin CAN supply an override time string ("HH:MM") to back-record attendance
 * for a specific moment (e.g. employee arrived at 08:05 but forgot to check in).
 * The date is always today unless explicitly supplied as a date string "YYYY-MM-DD".
 * Both are validated server-side.
 */

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { getOrgLocalDateString, parseDateOnly, getServerNow } from "@/lib/attendance-date";
import { evaluateCheckInStatus } from "@/lib/attendance-policy";
import { getAttendancePolicy } from "./policy-queries";

// ── Shared audit helper ────────────────────────────────────────────────────

async function logAdminAudit(
  action: string,
  entityId: string,
  changes: unknown,
  adminUserId: string
) {
  await prisma.auditLog.create({
    data: {
      action,
      entity: "Attendance",
      entityId,
      changes: changes as object,
      userId: adminUserId,
    },
  });
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
    const dateInput  = String(formData.get("date") ?? "").trim() || getOrgLocalDateString();
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
      select: { id: true, firstName: true, lastName: true, employeeId: true, deletedAt: true },
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

    // Check for existing check-in
    const existing = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId, date: dateValue } },
      select: { id: true, checkIn: true },
    });
    if (existing?.checkIn !== null && existing?.checkIn !== undefined) {
      throw new Error(
        `${employee.firstName} ${employee.lastName} already has a check-in recorded for ${dateInput}.`
      );
    }

    // Build check-in timestamp (admin can supply an override time)
    const checkInTs = buildTimestamp(dateInput, timeInput);

    // Validate override time is not in the future relative to now
    if (checkInTs > getServerNow()) {
      throw new Error("Check-in time cannot be in the future.");
    }

    // Policy-based status calculation — Admin does NOT manually pick status
    const policy = await getAttendancePolicy();
    const status  = evaluateCheckInStatus(checkInTs, policy, dateInput);

    let record;
    if (existing) {
      record = await prisma.attendance.update({
        where: { id: existing.id },
        data: { checkIn: checkInTs, status, notes, recordedById: session!.user.id },
        select: { id: true },
      });
    } else {
      record = await prisma.attendance.create({
        data: {
          employeeId,
          date: dateValue,
          status,
          checkIn: checkInTs,
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
        targetEmployeeId: employeeId,
        targetEmployeeCode: employee.employeeId,
        targetEmployeeName: `${employee.firstName} ${employee.lastName}`,
        date: dateInput,
        checkIn: checkInTs.toISOString(),
        status,
        recordedByAdmin: session!.user.id,
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
 * formData fields:
 *   employeeId   – target employee DB id
 *   date         – optional "YYYY-MM-DD"; defaults to today
 *   checkOutTime – optional "HH:MM" org-local; defaults to current server time
 *   notes        – optional remarks
 */
export async function adminCheckOut(
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_ATTENDANCE", async () => {
    const employeeId = String(formData.get("employeeId") ?? "").trim();
    const dateInput  = String(formData.get("date") ?? "").trim() || getOrgLocalDateString();
    const timeInput  = String(formData.get("checkOutTime") ?? "").trim() || null;
    const notes      = String(formData.get("notes") ?? "").trim() || null;

    if (!employeeId) throw new Error("Employee ID is required.");

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      throw new Error("Invalid date format. Use YYYY-MM-DD.");
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, firstName: true, lastName: true, employeeId: true, deletedAt: true },
    });
    if (!employee) throw new Error("Employee not found.");
    if (employee.deletedAt !== null) {
      throw new Error("Cannot record attendance for an archived employee.");
    }

    const dateValue = parseDateOnly(dateInput);

    const existing = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId, date: dateValue } },
      select: { id: true, checkIn: true, checkOut: true },
    });

    if (!existing || existing.checkIn === null) {
      throw new Error(
        `${employee.firstName} ${employee.lastName} has no check-in record for ${dateInput}. Check in first.`
      );
    }
    if (existing.checkOut !== null) {
      throw new Error(
        `${employee.firstName} ${employee.lastName} already has a check-out recorded for ${dateInput}.`
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
      data: { checkOut: checkOutTs, recordedById: session!.user.id, ...(notes ? { notes } : {}) },
      select: { id: true },
    });

    await logAdminAudit(
      "ADMIN_CHECK_OUT",
      record.id,
      {
        targetEmployeeId: employeeId,
        targetEmployeeCode: employee.employeeId,
        targetEmployeeName: `${employee.firstName} ${employee.lastName}`,
        date: dateInput,
        checkIn: existing.checkIn.toISOString(),
        checkOut: checkOutTs.toISOString(),
        recordedByAdmin: session!.user.id,
        notes,
      },
      session!.user.id
    );

    revalidatePath("/attendance");
    revalidatePath("/attendance/management");
    return { id: record.id };
  });
}
