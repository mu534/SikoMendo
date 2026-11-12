/**
 * Attendance absence-detection and finalization jobs.
 *
 * These functions are called by authenticated API routes (app/api/jobs/…),
 * NOT by browser code. They have no 'use server' directive — they are plain
 * library functions, not Next.js Server Actions.
 *
 * Stage 1 — runAbsenceDetection(dateStr, session):
 *   Called at a session's configured deadline. Marks employees who have no
 *   attendance row for (date, session) as ABSENT + autoRecorded=true.
 *   Uses createMany with skipDuplicates so re-running is safe.
 *   Short-circuits when all eligible employees already have a row.
 *
 * Stage 2 — runAbsenceFinalization(dateStr):
 *   Called daily. Re-checks all auto-recorded ABSENT rows with no checkIn.
 *   Employees who now have approved leave are updated to ON_LEAVE.
 *   Writes audit log entries for finalised rows.
 *
 * Idempotency: both functions are safe to re-run. createMany uses
 * skipDuplicates; detection's eligibility filter is "no row exists for
 * (date, session)" so once a row exists re-runs produce nothing; finalization
 * queries target only autoRecorded rows with checkIn: null; audit logs are
 * appended (never overwritten).
 */

import "server-only";
import prisma from "@/lib/prisma";
import { parseDateOnly } from "@/lib/attendance-date";
import { getAttendancePolicy } from "@/features/attendance/policy-queries";
import { isWorkingDay } from "@/lib/attendance-policy";
import { isHolidayDate } from "@/features/attendance/calendar-queries";
import { createNotification } from "@/lib/notifications";
import type { AttendanceSession } from "@/lib/attendance-policy";

// ── Types ─────────────────────────────────────────────────────────────────

export type DetectionResult = {
  date: string;
  session: AttendanceSession;
  skippedNonWorkingDay: boolean;
  markedAbsent: number;
  notifiedUsers: number;
};

export type FinalizationResult = {
  date: string;
  skippedNonWorkingDay: boolean;
  finalized: number;
  correctedToOnLeave: number;
};

// ── Stage 1: Absence Detection ────────────────────────────────────────────

/**
 * Scans active employees for the given date and session, and creates ABSENT
 * records for any who have no attendance row for (date, session) and no
 * approved leave covering that date.
 *
 * Idempotent: once a row exists for (employeeId, date, session), subsequent
 * runs exclude that employee (short-circuit). createMany with skipDuplicates
 * plus the DB unique constraint on (employeeId, date, session) guarantee no
 * duplicates under concurrent execution.
 *
 * @param dateStr  Org-local date in "YYYY-MM-DD" format.
 * @param session  The session to run detection for ("MORNING" or "AFTERNOON").
 */
export async function runAbsenceDetection(
  dateStr: string,
  session: AttendanceSession
): Promise<DetectionResult> {
  const policy = await getAttendancePolicy();

  if (!isWorkingDay(dateStr, policy)) {
    console.log(`[absence-detection] ${dateStr} ${session} is not a working day — skipping.`);
    return {
      date: dateStr,
      session,
      skippedNonWorkingDay: true,
      markedAbsent: 0,
      notifiedUsers: 0,
    };
  }

  // Check calendar for holidays — if this date is a holiday, skip detection.
  const isHoliday = await isHolidayDate(dateStr);
  if (isHoliday) {
    console.log(`[absence-detection] ${dateStr} ${session} is a calendar holiday — skipping.`);
    return {
      date: dateStr,
      session,
      skippedNonWorkingDay: true,
      markedAbsent: 0,
      notifiedUsers: 0,
    };
  }

  const dateValue = parseDateOnly(dateStr);

  // Load all active, non-deleted employees with their attendance rows for
  // (date, session) and approved leave requests covering this date.
  const employees = await prisma.employee.findMany({
    where: {
      deletedAt: null,
      employmentStatus: "ACTIVE",
    },
    select: {
      id: true,
      attendances: {
        where: { date: dateValue, session },
        select: { id: true, checkIn: true },
      },
      leaveRequests: {
        where: {
          status: "APPROVED",
          startDate: { lte: dateValue },
          endDate: { gte: dateValue },
        },
        select: { id: true },
      },
    },
  });

  // Eligibility: no attendance row at all for (date, session) — not "row exists
  // but checkIn is null". Once the first run creates the auto-ABSENT row, that
  // employee has a row and all subsequent runs skip them (short-circuit).
  // Also skip employees with approved leave (day-granular — both sessions exempt).
  const toMarkAbsent = employees
    .filter((emp) => {
      const hasApprovedLeave = emp.leaveRequests.length > 0;
      if (hasApprovedLeave) return false;
      // Already has a row for (date, session) → skip (auto-absent or real check-in)
      const hasRow = emp.attendances.length > 0;
      if (hasRow) return false;
      return true;
    })
    .map((emp) => emp.id);

  if (toMarkAbsent.length === 0) {
    console.log(
      `[absence-detection] ${dateStr} ${session}: no new absences to record.`
    );
    return {
      date: dateStr,
      session,
      skippedNonWorkingDay: false,
      markedAbsent: 0,
      notifiedUsers: 0,
    };
  }

  // createMany with skipDuplicates: running twice is safe — the @@unique
  // constraint on (employeeId, date, session) prevents double-recording.
  const result = await prisma.attendance.createMany({
    data: toMarkAbsent.map((employeeId) => ({
      employeeId,
      date: dateValue,
      session,
      status: "ABSENT" as const,
      autoRecorded: true,
    })),
    skipDuplicates: true,
  });

  console.log(
    `[absence-detection] ${dateStr} ${session}: created ${result.count} absence record(s) for ${toMarkAbsent.length} eligible employee(s).`
  );

  // Notify HR_OFFICER and ADMIN users about potential absences.
  let notifiedUsers = 0;
  if (result.count > 0) {
    const hrAdminUsers = await prisma.user.findMany({
      where: {
        role: { in: ["ADMIN", "HR_OFFICER"] },
        banned: false,
      },
      select: { id: true },
    });

    for (const u of hrAdminUsers) {
      try {
        await createNotification(
          u.id,
          "ABSENCE_DETECTED",
          "Potential Absences Detected",
          `${result.count} employee(s) have not checked in for the ${session.toLowerCase()} session as of ${dateStr}. Please review the attendance register.`
        );
        notifiedUsers++;
      } catch (err) {
        console.error(`[absence-detection] Failed to notify user ${u.id}:`, err);
      }
    }
  }

  return {
    date: dateStr,
    session,
    skippedNonWorkingDay: false,
    markedAbsent: result.count,
    notifiedUsers,
  };
}

// ── Stage 2: Absence Finalization ─────────────────────────────────────────

/**
 * Reviews all auto-recorded ABSENT rows for the given date (both sessions).
 * - Rows where the employee has since received approved leave → updated to ON_LEAVE.
 * - Remaining rows without a checkIn → finalised as confirmed absent.
 * - Audit log entries created for all finalised rows (includes session in payload).
 *
 * @param dateStr  Org-local date in "YYYY-MM-DD" format.
 */
export async function runAbsenceFinalization(dateStr: string): Promise<FinalizationResult> {
  const policy = await getAttendancePolicy();

  if (!isWorkingDay(dateStr, policy)) {
    console.log(`[absence-finalization] ${dateStr} is not a working day — skipping.`);
    return {
      date: dateStr,
      skippedNonWorkingDay: true,
      finalized: 0,
      correctedToOnLeave: 0,
    };
  }

  const dateValue = parseDateOnly(dateStr);

  // Find all auto-recorded absence rows for either session that still have no checkIn.
  const pendingRows = await prisma.attendance.findMany({
    where: {
      date: dateValue,
      status: "ABSENT",
      autoRecorded: true,
      checkIn: null,
    },
    select: {
      id: true,
      employeeId: true,
      session: true,
    },
  });

  if (pendingRows.length === 0) {
    console.log(
      `[absence-finalization] ${dateStr}: no auto-recorded absences to finalize.`
    );
    return {
      date: dateStr,
      skippedNonWorkingDay: false,
      finalized: 0,
      correctedToOnLeave: 0,
    };
  }

  // Re-check approved leave for each pending employee.
  const employeeIds = pendingRows.map((r) => r.employeeId);

  const approvedLeaves = await prisma.leaveRequest.findMany({
    where: {
      employeeId: { in: employeeIds },
      status: "APPROVED",
      startDate: { lte: dateValue },
      endDate: { gte: dateValue },
    },
    select: { employeeId: true },
  });

  const onLeaveEmployeeIds = new Set(approvedLeaves.map((l) => l.employeeId));

  const leaveRows = pendingRows.filter((r) => onLeaveEmployeeIds.has(r.employeeId));
  const absentRows = pendingRows.filter((r) => !onLeaveEmployeeIds.has(r.employeeId));

  // Update leave-covered rows to ON_LEAVE.
  let correctedToOnLeave = 0;
  if (leaveRows.length > 0) {
    const leaveIds = leaveRows.map((r) => r.id);
    await prisma.attendance.updateMany({
      where: { id: { in: leaveIds } },
      data: { status: "ON_LEAVE" },
    });
    correctedToOnLeave = leaveRows.length;
    console.log(
      `[absence-finalization] ${dateStr}: corrected ${correctedToOnLeave} row(s) to ON_LEAVE.`
    );
  }

  // Write audit logs for confirmed absent rows (payload includes session).
  if (absentRows.length > 0) {
    await prisma.auditLog.createMany({
      data: absentRows.map((r) => ({
        action: "AUTO_FINALIZE_ABSENT",
        entity: "Attendance",
        entityId: r.id,
        changes: {
          dateStr,
          session: r.session,
          status: "ABSENT",
          autoRecorded: true,
          stage: "finalization",
        } as object,
      })),
    });
    console.log(
      `[absence-finalization] ${dateStr}: finalised ${absentRows.length} absence record(s).`
    );
  }

  return {
    date: dateStr,
    skippedNonWorkingDay: false,
    finalized: absentRows.length,
    correctedToOnLeave,
  };
}
