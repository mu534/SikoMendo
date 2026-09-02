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

// ── Employee: submit a new leave request ────────────────────────────────────

export async function submitLeaveRequest(
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_OWN_LEAVE", async () => {
    const employee = await getOwnEmployeeOrThrow(session!.user.id);

    // Only a direct manager can decide a leave request, so there must be an
    // active, logged-in manager to route this to before we accept it at all —
    // otherwise it would sit pending forever with no one able to act on it.
    const route = await resolveLeaveApprovalRoute(employee.id);
    if (route.kind !== "MANAGER") {
      throw new Error(
        `You can't submit a leave request yet: ${route.reason} Leave requests can only be decided by your direct manager, so please ask HR to assign one to your employee record first.`
      );
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

    // route was already validated as MANAGER above — notify them directly.
    const employeeName = `${employee.firstName} ${employee.lastName}`;
    await createNotification(
      route.userId,
      "LEAVE_SUBMITTED",
      "New leave request awaiting your decision",
      `${employeeName} submitted a ${LEAVE_TYPE_LABELS[parsed.data.leaveType]} request (${leaveId}, ${totalDays} day${totalDays === 1 ? "" : "s"}) for your review.`
    );

    revalidatePath("/leave");
    return { id: leaveRequest.id };
  });
}

// ── Employee: cancel a pending request ──────────────────────────────────────

export async function cancelLeaveRequest(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_OWN_LEAVE", async () => {
    const employee = await getOwnEmployeeOrThrow(session!.user.id);

    const existing = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!existing) throw new Error("Leave request not found.");
    if (existing.employeeId !== employee.id) {
      throw new Error("You can only cancel your own leave requests.");
    }
    if (existing.status !== "PENDING") {
      throw new Error("Only pending leave requests can be cancelled.");
    }

    await prisma.leaveRequest.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    await logAudit("CANCEL", "LeaveRequest", id, { from: existing.status, to: "CANCELLED" }, session!.user.id);

    revalidatePath("/leave");
    revalidatePath(`/leave/${id}`);
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
        employee: { select: { managerId: true } },
      },
    });
    if (!existing) throw new Error("Leave request not found.");
    if (existing.status !== "PENDING") {
      throw new Error("This request has already been decided.");
    }

    // Leave approval is manager-only: MANAGE_LEAVE is granted solely to the
    // MANAGER role (see lib/permissions.ts), so anyone reaching this point is
    // a manager. They can still only decide for their own direct reports —
    // the manager hierarchy (Employee.managerId) enforces that here rather
    // than letting any manager approve anyone in the org.
    const approverEmployee = await prisma.employee.findUnique({
      where: { userId: session!.user.id },
      select: { id: true },
    });
    if (!approverEmployee || existing.employee.managerId !== approverEmployee.id) {
      throw new Error("You can only decide leave requests for your own direct reports.");
    }

    const parsed = leaveDecisionSchema.safeParse(leaveDecisionFormDataToObject(formData));
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }

    await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: parsed.data.decision,
        decisionDate: new Date(),
        approverId: session!.user.id,
        rejectionReason: parsed.data.decision === "REJECTED" ? parsed.data.rejectionReason : null,
      },
    });

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
      { decision: parsed.data.decision, rejectionReason: parsed.data.rejectionReason ?? null },
      session!.user.id
    );

    const employee = await prisma.employee.findUnique({
      where: { id: existing.employeeId },
      select: { userId: true },
    });
    if (employee?.userId) {
      if (parsed.data.decision === "APPROVED") {
        await createNotification(
          employee.userId,
          "LEAVE_APPROVED",
          "Leave request approved",
          `Your ${existing.leaveId} leave request has been approved.`
        );
      } else {
        await createNotification(
          employee.userId,
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
