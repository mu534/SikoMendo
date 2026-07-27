"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { uploadToCloudinary } from "@/lib/cloudinary";
import {
  leaveRequestSchema,
  leaveRequestFormDataToObject,
  leaveDecisionSchema,
  leaveDecisionFormDataToObject,
  calculateTotalDays,
} from "./schemas";
import { generateNextLeaveId, hasOverlappingLeave } from "./queries";

async function logAudit(action: string, entityId: string, changes: unknown, userId?: string) {
  await prisma.auditLog.create({
    data: { action, entity: "LeaveRequest", entityId, changes: changes as object, userId },
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

    const document = getDocumentFile(formData);
    const asset = document
      ? await uploadToCloudinary(document, "siko-mendo/leave", { resourceType: "auto" })
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
        status: "PENDING",
      },
    });

    await logAudit("CREATE", leaveRequest.id, { leaveId, leaveType: parsed.data.leaveType, totalDays }, session!.user.id);

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

    await logAudit("CANCEL", id, { from: existing.status, to: "CANCELLED" }, session!.user.id);

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
    const existing = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!existing) throw new Error("Leave request not found.");
    if (existing.status !== "PENDING") {
      throw new Error("This request has already been decided.");
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
      id,
      { decision: parsed.data.decision, rejectionReason: parsed.data.rejectionReason ?? null },
      session!.user.id
    );

    revalidatePath("/leave");
    revalidatePath(`/leave/${id}`);
    if (parsed.data.decision === "APPROVED") {
      revalidatePath("/attendance");
      revalidatePath("/dashboard");
    }
    return { id };
  });
}