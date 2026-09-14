"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { parseTimeToMinutes } from "@/lib/attendance-policy";

// ── Validation schema ──────────────────────────────────────────────────────

const shiftSchema = z.object({
  name: z.string().trim().min(1, "Shift name is required").max(60, "Name too long"),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Start time must be in HH:MM format (e.g. 08:00)"),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "End time must be in HH:MM format (e.g. 17:00)"),
}).superRefine((data, ctx) => {
  const startMins = parseTimeToMinutes(data.startTime);
  const endMins   = parseTimeToMinutes(data.endTime);
  if (endMins <= startMins) {
    ctx.addIssue({
      code: "custom",
      path: ["endTime"],
      message: "End time must be after start time",
    });
  }
});

function extractShiftFromFormData(formData: FormData) {
  return {
    name:      String(formData.get("name")      ?? "").trim(),
    startTime: String(formData.get("startTime") ?? "").trim(),
    endTime:   String(formData.get("endTime")   ?? "").trim(),
  };
}

async function logAudit(action: string, entityId: string, changes: unknown, userId?: string) {
  await prisma.auditLog.create({
    data: { action, entity: "WorkShift", entityId, changes: changes as object, userId },
  });
}

// ── Create ────────────────────────────────────────────────────────────────

export async function createShift(
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_ATTENDANCE_POLICY", async () => {
    const raw    = extractShiftFromFormData(formData);
    const parsed = shiftSchema.safeParse(raw);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");

    // Enforce unique name (case-insensitive)
    const existing = await prisma.workShift.findFirst({
      where: { name: { equals: parsed.data.name, mode: "insensitive" } },
      select: { id: true },
    });
    if (existing) throw new Error(`A shift named "${parsed.data.name}" already exists.`);

    const shift = await prisma.workShift.create({
      data: {
        name:        parsed.data.name,
        startTime:   parsed.data.startTime,
        endTime:     parsed.data.endTime,
        createdById: session!.user.id,
      },
      select: { id: true },
    });

    await logAudit("CREATE", shift.id, parsed.data, session!.user.id);
    revalidatePath("/attendance/policy");
    return { id: shift.id };
  });
}

// ── Update ────────────────────────────────────────────────────────────────

export async function updateShift(
  id: string,
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_ATTENDANCE_POLICY", async () => {
    const raw    = extractShiftFromFormData(formData);
    const parsed = shiftSchema.safeParse(raw);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");

    const existing = await prisma.workShift.findUnique({ where: { id } });
    if (!existing) throw new Error("Shift not found.");

    // Name uniqueness check (excluding self)
    const conflict = await prisma.workShift.findFirst({
      where: { name: { equals: parsed.data.name, mode: "insensitive" }, id: { not: id } },
      select: { id: true },
    });
    if (conflict) throw new Error(`A shift named "${parsed.data.name}" already exists.`);

    await prisma.workShift.update({
      where: { id },
      data: {
        name:      parsed.data.name,
        startTime: parsed.data.startTime,
        endTime:   parsed.data.endTime,
      },
    });

    await logAudit("UPDATE", id, parsed.data, session!.user.id);
    revalidatePath("/attendance/policy");
    return { id };
  });
}

// ── Activate / deactivate ─────────────────────────────────────────────────

export async function setShiftActive(
  id: string,
  isActive: boolean
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_ATTENDANCE_POLICY", async () => {
    const existing = await prisma.workShift.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new Error("Shift not found.");

    await prisma.workShift.update({ where: { id }, data: { isActive } });
    await logAudit(isActive ? "ACTIVATE" : "DEACTIVATE", id, { isActive }, session!.user.id);
    revalidatePath("/attendance/policy");
    return { id };
  });
}

// ── Delete ────────────────────────────────────────────────────────────────

export async function deleteShift(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_ATTENDANCE_POLICY", async () => {
    const shift = await prisma.workShift.findUnique({
      where: { id },
      include: { _count: { select: { employees: true } } },
    });
    if (!shift) throw new Error("Shift not found.");
    if (shift._count.employees > 0) {
      throw new Error(
        `Cannot delete "${shift.name}" — ${shift._count.employees} employee(s) are assigned to it. Reassign them first.`
      );
    }

    await prisma.workShift.delete({ where: { id } });
    await logAudit("DELETE", id, { name: shift.name }, session!.user.id);
    revalidatePath("/attendance/policy");
    return { id };
  });
}
