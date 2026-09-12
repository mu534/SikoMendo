"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { getOrgLocalDateString, getServerNow, parseDateOnly } from "@/lib/attendance-date";
import { evaluateCheckInStatus } from "@/lib/attendance-policy";
import { getAttendancePolicy } from "./policy-queries";

// ── Shared audit helper ────────────────────────────────────────────────────

async function logAudit(
  action: string,
  entityId: string,
  changes: unknown,
  userId?: string
) {
  await prisma.auditLog.create({
    data: { action, entity: "Attendance", entityId, changes: changes as object, userId },
  });
}

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
 * Security:
 *   - Employee resolved from session — never from client input.
 *   - Date is org-local today (server-generated).
 *   - Check-in timestamp is server-generated (new Date()).
 *   - Status is calculated by the policy engine — never accepted from the client.
 *   - Approved leave blocks check-in.
 *   - Duplicate check-in is rejected.
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
      throw new Error("You are on approved leave today. Check-in is not available on leave days.");
    }

    // Reject duplicate check-in
    const existing = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId: employee.id, date: todayDate } },
      select: { id: true, checkIn: true, status: true },
    });
    if (existing?.checkIn !== null && existing?.checkIn !== undefined) {
      throw new Error("You have already checked in today.");
    }

    // Server timestamp — never from client
    const now = getServerNow();

    // Load active policy and calculate status
    const policy = await getAttendancePolicy();
    const status = evaluateCheckInStatus(now, policy, todayStr);

    let record;
    if (existing) {
      record = await prisma.attendance.update({
        where: { id: existing.id },
        data: { checkIn: now, status, recordedById: session!.user.id },
        select: { id: true },
      });
    } else {
      record = await prisma.attendance.create({
        data: {
          employeeId: employee.id,
          date: todayDate,
          status,
          checkIn: now,
          recordedById: session!.user.id,
        },
        select: { id: true },
      });
    }

    await logAudit(
      "ATTENDANCE_CHECK_IN",
      record.id,
      { employeeId: employee.id, date: todayStr, checkIn: now.toISOString(), status },
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
 * Records today's check-out for the authenticated employee.
 *
 * Security:
 *   - Employee resolved from session — never from client input.
 *   - Check-out timestamp is server-generated.
 *   - Requires prior check-in. Duplicate check-out rejected.
 *   - checkOut > checkIn enforced.
 */
export async function selfCheckOut(): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "SELF_ATTENDANCE", async () => {
    const employee  = await resolveOwnEmployee(session!.user.id);
    const todayStr  = getOrgLocalDateString();
    const todayDate = parseDateOnly(todayStr);

    const existing = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId: employee.id, date: todayDate } },
      select: { id: true, checkIn: true, checkOut: true },
    });

    if (!existing || existing.checkIn === null) {
      throw new Error("You have not checked in today. Check in first.");
    }
    if (existing.checkOut !== null) {
      throw new Error("You have already checked out today.");
    }

    const now = getServerNow();

    if (now <= existing.checkIn) {
      throw new Error("Check-out time must be after check-in time. Please try again.");
    }

    const record = await prisma.attendance.update({
      where: { id: existing.id },
      data: { checkOut: now, recordedById: session!.user.id },
      select: { id: true },
    });

    await logAudit(
      "ATTENDANCE_CHECK_OUT",
      record.id,
      {
        employeeId: employee.id,
        date: todayStr,
        checkIn: existing.checkIn.toISOString(),
        checkOut: now.toISOString(),
      },
      session!.user.id
    );

    revalidatePath("/attendance");
    revalidatePath("/attendance/mine");
    revalidatePath("/dashboard");
    return { id: record.id };
  });
}
