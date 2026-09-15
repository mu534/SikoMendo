"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { createNotification } from "@/lib/notifications";
import {
  leaveRequestSchema,
  leaveRequestFormDataToObject,
  leaveDecisionSchema,
  leaveDecisionFormDataToObject,
  calculateTotalDays,
  LEAVE_TYPE_LABELS,
  LEAVE_TYPES,
} from "./schemas";
import { generateNextLeaveId, hasOverlappingLeave, getEmployeeLeaveBalances, resolveLeaveApprovalRoute } from "./queries";
import { assertLeaveDecisionAuthority } from "@/lib/employee-access";

async function logAudit(action: string, entity: string, entityId: string, changes: unknown, userId?: string) {
  await prisma.auditLog.create({
    data: { action, entity, entityId, changes: changes as object, userId },
  });
}

function getDocumentFile(formData: FormData): File | null {
  const file = formData.get("document");
  return file instanceof File && file.size > 0 ? file : null;
}

function parseDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/** Resolves the Employee record linked to the signed-in user, or throws a friendly error. */
async function getOwnEmployeeOrThrow(userId: string) {
  const employee = await prisma.employee.findUnique({ where: { userId } });
  if (!employee) {
    throw new Error(
      "Your account isn't linked to an employee record yet. Contact HR to have your account linked before requesting leave."
    );
  }
  return employee;
}

/** Generates one Date per day in [startDate, endDate], inclusive. */
function eachDateInRange(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Marks each day of an approved leave as "On Leave" in Attendance — but only
 * for days that don't already have an attendance record, so we never
 * overwrite a real check-in/check-out that was already recorded.
 */
async function markAttendanceForApprovedLeave(
  employeeId: string,
  startDate: Date,
  endDate: Date,
  leaveId: string,
  recordedById: string
) {
  const dates = eachDateInRange(startDate, endDate);

  await prisma.attendance.createMany({
    data: dates.map((date) => ({
      employeeId,
      date,
      status: "ON_LEAVE" as const,
      notes: `Approved leave (${leaveId})`,
      recordedById,
    })),
    skipDuplicates: true,
  });
}

/**
 * Removes ON_LEAVE attendance records that were created when a leave was
 * approved — called when a leave is cancelled after approval so those
 * dates return to normal attendance processing.
 * Only removes records with status ON_LEAVE; never touches real attendance.
 */
async function removeLeaveAttendanceRecords(
  employeeId: string,
  startDate: Date,
  endDate: Date
) {
  const dates = eachDateInRange(startDate, endDate);
  await prisma.attendance.deleteMany({
    where: {
      employeeId,
      status: "ON_LEAVE",
      date: { in: dates },
    },
  });
}

// ── Employee: submit a new leave request ────────────────────────────────────

export async function submitLeaveRequest(
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_OWN_LEAVE", async () => {
    const employee = await getOwnEmployeeOrThrow(session!.user.id);

    // Resolve who will approve this leave request.
    //
    // Priority:
    //   1. Direct manager (primary) — owns day-to-day team coverage.
    //   2. General Manager (org-wide fallback) — valid when no direct manager
    //      is assigned or reachable. The GM holds MANAGE_LEAVE org-wide.
    //   3. Unroutable — neither path available; block submission with a clear
    //      actionable message so the employee knows exactly what HR must fix.
    //
    // The General Manager is ALWAYS a valid approver for any employee's leave,
    // so an employee with no direct manager can still submit leave — it will
    // route to the GM instead.
    //
    // EXCEPTION: if the submitter IS the General Manager, skip route validation
    // entirely — there is no upward approver, and Admin will decide on their
    // behalf from the leave management view.
    const isGeneralManager = session!.user.role === "MANAGER";
    const route = await resolveLeaveApprovalRoute(employee.id);

    if (!isGeneralManager && route.kind === "UNROUTABLE") {
      throw new Error(route.reason);
    }

    const parsed = leaveRequestSchema.safeParse(leaveRequestFormDataToObject(formData));
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }

    const startDate = parseDateOnly(parsed.data.startDate);
    const endDate = parseDateOnly(parsed.data.endDate);
    const totalDays = calculateTotalDays(parsed.data.startDate, parsed.data.endDate);

    const overlaps = await hasOverlappingLeave({ employeeId: employee.id, startDate, endDate });
    if (overlaps) {
      throw new Error("You already have a pending or approved leave request that overlaps these dates.");
    }

    // Balance check is based on the start date's calendar year — a request spanning
    // a year boundary is checked against the year it starts in, not split across both.
    const balances = await getEmployeeLeaveBalances(employee.id, startDate.getUTCFullYear());
    const balance = balances.find((b) => b.leaveType === parsed.data.leaveType);
    if (balance && balance.remaining !== null && totalDays > balance.remaining) {
      throw new Error(
        `Insufficient ${LEAVE_TYPE_LABELS[parsed.data.leaveType]} balance: ${balance.remaining} day(s) remaining this year, but ${totalDays} requested.`
      );
    }

    const document = getDocumentFile(formData);
    const asset = document
      ? await uploadToCloudinary(document, "siko-mendo/leave", { resourceType: "auto", access: "authenticated" })
      : null;

    const leaveId = await generateNextLeaveId();

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        leaveId,
        employeeId: employee.id,
        leaveType: parsed.data.leaveType,
        startDate,
        endDate,
        totalDays,
        reason: parsed.data.reason,
        documentUrl: asset?.url ?? null,
        documentKey: asset?.publicId ?? null,
        documentResourceType: asset?.resourceType ?? null,
        status: "PENDING",
      },
    });

    await logAudit("CREATE", "LeaveRequest", leaveRequest.id, { leaveId, leaveType: parsed.data.leaveType, totalDays }, session!.user.id);

    // Send a notification to the resolved approver.
    //
    // - MANAGER route: direct manager is notified (primary path).
    // - GENERAL_MANAGER route: GM is notified as the fallback approver.
    // - GM submitting own leave (isGeneralManager): no upward approver exists;
    //   no notification sent — Admin decides from the leave management view.
    if (!isGeneralManager && (route.kind === "MANAGER" || route.kind === "GENERAL_MANAGER")) {
      const employeeName = `${employee.firstName} ${employee.lastName}`;
      await createNotification(
        route.userId,
        "LEAVE_SUBMITTED",
        "New leave request awaiting your decision",
        `${employeeName} submitted a ${LEAVE_TYPE_LABELS[parsed.data.leaveType]} request (${leaveId}, ${totalDays} day${totalDays === 1 ? "" : "s"}) for your review.`
      );
    }

    revalidatePath("/leave");
    return { id: leaveRequest.id };
  });
}

// ── Employee: cancel a pending OR approved request ─────────────────────────

export async function cancelLeaveRequest(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_OWN_LEAVE", async () => {
    const employee = await getOwnEmployeeOrThrow(session!.user.id);

    const existing = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!existing) throw new Error("Leave request not found.");
    if (existing.employeeId !== employee.id) {
      throw new Error("You can only cancel your own leave requests.");
    }
    if (existing.status !== "PENDING" && existing.status !== "APPROVED") {
      throw new Error("Only pending or approved leave requests can be cancelled.");
    }

    await prisma.leaveRequest.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    // If the leave was already approved, remove the ON_LEAVE attendance records
    // that were created at approval time so those dates return to normal processing.
    if (existing.status === "APPROVED") {
      await removeLeaveAttendanceRecords(
        existing.employeeId,
        existing.startDate,
        existing.endDate
      );
    }

    await logAudit("CANCEL", "LeaveRequest", id, { from: existing.status, to: "CANCELLED" }, session!.user.id);

    revalidatePath("/leave");
    revalidatePath(`/leave/${id}`);
    if (existing.status === "APPROVED") {
      revalidatePath("/attendance");
    }
    return { id };
  });
}

// ── Manager/Admin: approve or reject a pending request ──────────────────────

export async function decideLeaveRequest(
  id: string,
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_LEAVE", async () => {
    const existing = await prisma.leaveRequest.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        employeeId: true,
        startDate: true,
        endDate: true,
        leaveId: true,
        employee: { select: { managerId: true, userId: true } },
      },
    });
    if (!existing) throw new Error("Leave request not found.");
    if (existing.status !== "PENDING") {
      throw new Error("This request has already been decided.");
    }

    // Authorization: General Manager has org-wide authority.
    // All other approvers must be the employee's direct manager.
    await assertLeaveDecisionAuthority(
      session!.user.id,
      session!.user.role,
      existing.employee.managerId
    );

    const parsed = leaveDecisionSchema.safeParse(leaveDecisionFormDataToObject(formData));
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }

    // Concurrency / double-decision protection: use updateMany with a status
    // filter so only one concurrent request can succeed. If the count is 0,
    // another request already decided this leave since we fetched it above.
    const updated = await prisma.leaveRequest.updateMany({
      where: { id, status: "PENDING" }, // Optimistic lock on PENDING state
      data: {
        status: parsed.data.decision,
        decisionDate: new Date(),
        approverId: session!.user.id,
        rejectionReason: parsed.data.decision === "REJECTED" ? parsed.data.rejectionReason : null,
      },
    });

    if (updated.count === 0) {
      // Another concurrent request already decided this — return a safe message.
      throw new Error("This leave request was already decided by another action. Please refresh the page.");
    }

    if (parsed.data.decision === "APPROVED") {
      await markAttendanceForApprovedLeave(
        existing.employeeId,
        existing.startDate,
        existing.endDate,
        existing.leaveId,
        session!.user.id
      );
    }

    await logAudit(
      parsed.data.decision === "APPROVED" ? "APPROVE" : "REJECT",
      "LeaveRequest",
      id,
      {
        decision: parsed.data.decision,
        rejectionReason: parsed.data.rejectionReason ?? null,
        decidedBy: session!.user.id,
        approverRole: session!.user.role,
      },
      session!.user.id
    );

    const employeeUserId = existing.employee.userId;
    if (employeeUserId) {
      if (parsed.data.decision === "APPROVED") {
        await createNotification(
          employeeUserId,
          "LEAVE_APPROVED",
          "Leave request approved",
          `Your ${existing.leaveId} leave request has been approved.`
        );
      } else {
        await createNotification(
          employeeUserId,
          "LEAVE_REJECTED",
          "Leave request rejected",
          `Your ${existing.leaveId} leave request was rejected${parsed.data.rejectionReason ? `: ${parsed.data.rejectionReason}` : "."}`
        );
      }
    }

    revalidatePath("/leave");
    revalidatePath(`/leave/${id}`);
    if (parsed.data.decision === "APPROVED") {
      revalidatePath("/attendance");
      revalidatePath("/dashboard");
    }
    return { id };
  });
}

// ── Admin: configure org-wide leave entitlement policy ──────────────────────

export async function updateLeaveEntitlements(
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<null>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_LEAVE_POLICY", async () => {
    const updates = LEAVE_TYPES.map((leaveType) => {
      const raw = formData.get(`days_${leaveType}`);
      const trimmed = typeof raw === "string" ? raw.trim() : "";
      const daysPerYear = trimmed === "" ? null : Number(trimmed);
      if (daysPerYear !== null && (!Number.isFinite(daysPerYear) || daysPerYear < 0)) {
        throw new Error(`Invalid entitlement for ${LEAVE_TYPE_LABELS[leaveType]}.`);
      }
      return { leaveType, daysPerYear };
    });

    await Promise.all(
      updates.map(({ leaveType, daysPerYear }) =>
        prisma.leaveEntitlement.upsert({
          where: { leaveType },
          create: { leaveType, daysPerYear },
          update: { daysPerYear },
        })
      )
    );

    await logAudit("UPDATE", "LeaveEntitlement", "policy", { updates }, session!.user.id);

    revalidatePath("/leave/policy");
    revalidatePath("/leave/new");
    return null;
  });
}
