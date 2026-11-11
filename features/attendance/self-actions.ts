"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { getOrgLocalDateString, getServerNow, parseDateOnly } from "@/lib/attendance-date";
import {
  routeCheckInToSession,
  evaluateSessionCheckIn,
  type AttendanceSession,
} from "@/lib/attendance-policy";
import { getAttendancePolicy } from "./policy-queries";

// ── Resolve employee from session — NEVER from client input ─────────────────

/**
 * Security guarantee: the employee is always derived from the authenticated
 * session — no client-supplied employeeId is accepted or trusted.
 */
async function resolveOwnEmployee(userId: string) {
  const employee = await prisma.employee.findUnique({
    where: { userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employmentStatus: true,
      deletedAt: true,
    },
  });

  if (!employee) {
    throw new Error(
      "Your account is not linked to an employee record. " +
        "Ask HR to link your account before recording attendance."
    );
  }
  if (employee.deletedAt !== null) {
    throw new Error("Your employee record has been archived. Contact HR.");
  }
  if (employee.employmentStatus !== "ACTIVE") {
    throw new Error(
      `Your employment status is ${employee.employmentStatus.replace(/_/g, " ").toLowerCase()}. ` +
        "Only Active employees can record attendance."
    );
  }

  return employee;
}

// ── Approved-leave check ────────────────────────────────────────────────────

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

// ── Self check-in ────────────────────────────────────────────────────────────

/**
 * Records today's check-in for the authenticated employee.
 *
 * Session is derived server-side from the check-in time and policy.
 * The employee cannot specify a session — it is always time-of-day routed.
 *
 * Security:
 *   - Employee resolved from session — never from client input.
 *   - Date is org-local today (server-generated).
 *   - Check-in timestamp is server-generated (new Date()).
 *   - Status is calculated by the policy engine — never accepted from the client.
 *   - Approved leave blocks check-in.
 *   - Duplicate check-in for the same session is rejected.
 */
export async function selfCheckIn(): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "SELF_ATTENDANCE", async () => {
    const employee  = await resolveOwnEmployee(session!.user.id);
    const todayStr  = getOrgLocalDateString();
    const todayDate = parseDateOnly(todayStr);

    // Block check-in on approved leave
    const onLeave = await isOnApprovedLeave(employee.id, todayDate);
    if (onLeave) {
      throw new Error(
        "You are on approved leave today. Check-in is not available on leave days."
      );
    }

    // Server timestamp — never from client
    const now = getServerNow();

    // Load active policy and derive session from time of day
    const policy = await getAttendancePolicy();
    const attendanceSession = routeCheckInToSession(now, policy);

    // Check for existing row for (employeeId, date, session)
    const existing = await prisma.attendance.findUnique({
      where: {
        employeeId_date_session: {
          employeeId: employee.id,
          date: todayDate,
          session: attendanceSession,
        },
      },
      select: { id: true, checkIn: true, autoRecorded: true },
    });

    // Reject duplicate: already has a real check-in for this session
    if (existing?.checkIn !== null && existing?.checkIn !== undefined) {
      throw new Error(
        `You have already checked in for the ${attendanceSession.toLowerCase()} session today.`
      );
    }

    const status = evaluateSessionCheckIn(now, policy, attendanceSession);

    let record;
    if (existing) {
      // Auto-ABSENT row exists (checkIn is null) — update in place with real check-in
      record = await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          checkIn:      now,
          status,
          autoRecorded: false,
          recordedById: session!.user.id,
        },
        select: { id: true },
      });
    } else {
      record = await prisma.attendance.create({
        data: {
          employeeId:  employee.id,
          date:        todayDate,
          session:     attendanceSession,
          status,
          checkIn:     now,
          recordedById: session!.user.id,
        },
        select: { id: true },
      });
    }

    await logAudit(
      "ATTENDANCE_CHECK_IN",
      "Attendance",
      record.id,
      {
        employeeId: employee.id,
        date:       todayStr,
        session:    attendanceSession,
        checkIn:    now.toISOString(),
        status,
      },
      session!.user.id
    );

    revalidatePath("/attendance");
    revalidatePath("/attendance/mine");
    revalidatePath("/dashboard");
    return { id: record.id };
  });
}

// ── Self check-out ───────────────────────────────────────────────────────────

/**
 * Records today's check-out for the authenticated employee for the given session.
 *
 * The session argument is supplied by the client (MORNING or AFTERNOON) but
 * the employee is always resolved from the authenticated session — there is no
 * cross-employee risk because the query always filters by the server-derived employeeId.
 *
 * Security:
 *   - Employee resolved from session — never from client input.
 *   - Check-out timestamp is server-generated.
 *   - Requires prior check-in for the session. Duplicate check-out rejected.
 *   - checkOut > checkIn enforced.
 *
 * Notes on selfCheckOut(session) per M1 design note:
 *   The session param routes to the row for that session. The row is verified
 *   to belong to the authenticated employee (server-derived employeeId), so
 *   the enum value cannot be used to affect another employee's data.
 */
export async function selfCheckOut(
  attendanceSession: AttendanceSession
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "SELF_ATTENDANCE", async () => {
    const employee  = await resolveOwnEmployee(session!.user.id);
    const todayStr  = getOrgLocalDateString();
    const todayDate = parseDateOnly(todayStr);

    const existing = await prisma.attendance.findUnique({
      where: {
        employeeId_date_session: {
          employeeId: employee.id,
          date:       todayDate,
          session:    attendanceSession,
        },
      },
      select: { id: true, checkIn: true, checkOut: true },
    });

    if (!existing || existing.checkIn === null) {
      throw new Error(
        `You have not checked in for the ${attendanceSession.toLowerCase()} session today. Check in first.`
      );
    }
    if (existing.checkOut !== null) {
      throw new Error(
        `You have already checked out for the ${attendanceSession.toLowerCase()} session today.`
      );
    }

    const now = getServerNow();

    if (now <= existing.checkIn) {
      throw new Error("Check-out time must be after check-in time. Please try again.");
    }

    const record = await prisma.attendance.update({
      where: { id: existing.id },
      data:  { checkOut: now, recordedById: session!.user.id },
      select: { id: true },
    });

    await logAudit(
      "ATTENDANCE_CHECK_OUT",
      "Attendance",
      record.id,
      {
        employeeId: employee.id,
        date:       todayStr,
        session:    attendanceSession,
        checkIn:    existing.checkIn.toISOString(),
        checkOut:   now.toISOString(),
      },
      session!.user.id
    );

    revalidatePath("/attendance");
    revalidatePath("/attendance/mine");
    revalidatePath("/dashboard");
    return { id: record.id };
  });
}
