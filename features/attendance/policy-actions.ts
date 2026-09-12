"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { parseTimeToMinutes } from "@/lib/attendance-policy";

// ── Validation schema ──────────────────────────────────────────────────────

const policySchema = z.object({
  workStartTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Work start time must be in HH:MM format (e.g. 08:00)"),

  workEndTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Work end time must be in HH:MM format (e.g. 17:00)"),

  gracePeriodMinutes: z
    .number({ error: "Grace period must be a number" })
    .int("Grace period must be a whole number")
    .min(0, "Grace period cannot be negative")
    .max(120, "Grace period cannot exceed 120 minutes"),

  halfDayThresholdMinutes: z
    .number({ error: "Half-day threshold must be a number" })
    .int("Half-day threshold must be a whole number")
    .min(1, "Half-day threshold must be at least 1 minute")
    .max(480, "Half-day threshold cannot exceed 8 hours (480 minutes)")
    .nullable(),

  workingDays: z
    .array(
      z.number().int().min(1).max(7)
    )
    .min(1, "At least one working day is required"),
}).superRefine((data, ctx) => {
  // Work end must be after work start
  const startMins = parseTimeToMinutes(data.workStartTime);
  const endMins   = parseTimeToMinutes(data.workEndTime);
  if (endMins <= startMins) {
    ctx.addIssue({
      code: "custom",
      path: ["workEndTime"],
      message: "Work end time must be after work start time",
    });
  }
});

function extractPolicyFromFormData(formData: FormData) {
  const raw = {
    workStartTime: String(formData.get("workStartTime") ?? "").trim(),
    workEndTime:   String(formData.get("workEndTime") ?? "").trim(),
    gracePeriodMinutes: Number(formData.get("gracePeriodMinutes")),
    halfDayThresholdMinutes:
      formData.get("halfDayThresholdMinutes") &&
      String(formData.get("halfDayThresholdMinutes")).trim() !== ""
        ? Number(formData.get("halfDayThresholdMinutes"))
        : null,
    workingDays: [1, 2, 3, 4, 5, 6, 7]
      .filter((d) => formData.get(`workingDay_${d}`) === "on"),
  };
  return raw;
}

// ── Server action ──────────────────────────────────────────────────────────

/**
 * ADMIN ONLY — create or update the singleton attendance policy row.
 *
 * Historical attendance records are NEVER touched by this action.
 * Status is calculated at check-in time and stored permanently.
 */
export async function upsertAttendancePolicy(
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_ATTENDANCE_POLICY", async () => {
    const raw = extractPolicyFromFormData(formData);
    const parsed = policySchema.safeParse(raw);

    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid policy values.");
    }

    const { workStartTime, workEndTime, gracePeriodMinutes, halfDayThresholdMinutes, workingDays } =
      parsed.data;

    const row = await prisma.attendancePolicy.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        workStartTime,
        workEndTime,
        gracePeriodMinutes,
        halfDayThresholdMinutes,
        workingDays: JSON.stringify(workingDays),
        updatedById: session!.user.id,
      },
      update: {
        workStartTime,
        workEndTime,
        gracePeriodMinutes,
        halfDayThresholdMinutes,
        workingDays: JSON.stringify(workingDays),
        updatedById: session!.user.id,
      },
      select: { id: true },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "AttendancePolicy",
        entityId: "singleton",
        changes: {
          workStartTime,
          workEndTime,
          gracePeriodMinutes,
          halfDayThresholdMinutes,
          workingDays,
        } as object,
        userId: session!.user.id,
      },
    });

    revalidatePath("/attendance/policy");
    return { id: row.id };
  });
}
