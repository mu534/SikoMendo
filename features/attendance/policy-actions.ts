"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { parseTimeToMinutes } from "@/lib/attendance-policy";

// ── Time field validator ───────────────────────────────────────────────────

/** Validates an HH:MM string — format and 00:00–23:59 range. */
const hhmm = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format (e.g. 08:00)")
  .refine(
    (v) => {
      const [h, m] = v.split(":").map(Number);
      return (h ?? 0) >= 0 && (h ?? 0) <= 23 && (m ?? 0) >= 0 && (m ?? 0) <= 59;
    },
    "Time must be between 00:00 and 23:59"
  );

// ── Validation schema ──────────────────────────────────────────────────────

const policySchema = z
  .object({
    morningStartTime:         hhmm,
    morningCheckInDeadline:   hhmm,
    afternoonStartTime:       hhmm,
    afternoonCheckInDeadline: hhmm,
    graceMinutes: z
      .number()
      .int("Grace period must be a whole number of minutes")
      .min(0, "Grace period cannot be negative")
      .max(240, "Grace period cannot exceed 240 minutes (4 hours)"),
    workingDays: z
      .array(z.number().int().min(1).max(7))
      .min(1, "At least one working day is required"),
  })
  .superRefine((data, ctx) => {
    const morningStartMin      = parseTimeToMinutes(data.morningStartTime);
    const morningDeadlineMin   = parseTimeToMinutes(data.morningCheckInDeadline);
    const afternoonStartMin    = parseTimeToMinutes(data.afternoonStartTime);
    const afternoonDeadlineMin = parseTimeToMinutes(data.afternoonCheckInDeadline);

    if (morningDeadlineMin < morningStartMin) {
      ctx.addIssue({
        code: "custom",
        path: ["morningCheckInDeadline"],
        message: "Morning check-in deadline must be at or after the morning start time",
      });
    }
    if (afternoonStartMin <= morningStartMin) {
      ctx.addIssue({
        code: "custom",
        path: ["afternoonStartTime"],
        message: "Afternoon start time must be after the morning start time",
      });
    }
    if (afternoonDeadlineMin < afternoonStartMin) {
      ctx.addIssue({
        code: "custom",
        path: ["afternoonCheckInDeadline"],
        message: "Afternoon check-in deadline must be at or after the afternoon start time",
      });
    }
  });

function extractPolicyFromFormData(formData: FormData) {
  return {
    morningStartTime:         String(formData.get("morningStartTime") ?? "").trim(),
    morningCheckInDeadline:   String(formData.get("morningCheckInDeadline") ?? "").trim(),
    afternoonStartTime:       String(formData.get("afternoonStartTime") ?? "").trim(),
    afternoonCheckInDeadline: String(formData.get("afternoonCheckInDeadline") ?? "").trim(),
    graceMinutes:             parseInt(String(formData.get("graceMinutes") ?? "15"), 10) || 0,
    workingDays: [1, 2, 3, 4, 5, 6, 7].filter(
      (d) => formData.get(`workingDay_${d}`) === "on"
    ),
  };
}

// ── Server action ──────────────────────────────────────────────────────────

/**
 * ADMIN or HR_OFFICER — create or update the singleton attendance policy row.
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
    const raw    = extractPolicyFromFormData(formData);
    const parsed = policySchema.safeParse(raw);

    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid policy values.");
    }

    const {
      morningStartTime,
      morningCheckInDeadline,
      afternoonStartTime,
      afternoonCheckInDeadline,
      graceMinutes,
      workingDays,
    } = parsed.data;

    const row = await prisma.attendancePolicy.upsert({
      where:  { id: "singleton" },
      create: {
        id: "singleton",
        morningStartTime,
        morningCheckInDeadline,
        afternoonStartTime,
        afternoonCheckInDeadline,
        graceMinutes,
        workingDays: JSON.stringify(workingDays),
        updatedById: session!.user.id,
      },
      update: {
        morningStartTime,
        morningCheckInDeadline,
        afternoonStartTime,
        afternoonCheckInDeadline,
        graceMinutes,
        workingDays: JSON.stringify(workingDays),
        updatedById: session!.user.id,
      },
      select: { id: true },
    });

    await logAudit(
      "UPDATE",
      "AttendancePolicy",
      "singleton",
      {
        morningStartTime,
        morningCheckInDeadline,
        afternoonStartTime,
        afternoonCheckInDeadline,
        graceMinutes,
        workingDays,
      },
      session!.user.id
    );

    revalidatePath("/attendance/policy");
    return { id: row.id };
  });
}
