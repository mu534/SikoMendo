"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import {
  upsertCalendarEntry,
  deleteCalendarEntry as deleteCalendarEntryQuery,
} from "./calendar-queries";
import type { CalendarType } from "@prisma/client";

// ── Validation schema ──────────────────────────────────────────────────────────

const CALENDAR_TYPES: CalendarType[] = [
  "PUBLIC_HOLIDAY",
  "RELIGIOUS_HOLIDAY",
  "ORG_HOLIDAY",
  "SPECIAL_NON_WORKING",
  "SPECIAL_WORKING",
];

const calendarEntrySchema = z.object({
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  name:         z.string().min(1, "Name is required").max(200),
  calendarType: z.enum(["PUBLIC_HOLIDAY", "RELIGIOUS_HOLIDAY", "ORG_HOLIDAY", "SPECIAL_NON_WORKING", "SPECIAL_WORKING"] as [CalendarType, ...CalendarType[]]),
  description:  z.string().optional().transform((v) => (v && v.trim() !== "" ? v.trim() : undefined)),
  isWorkingDay: z.boolean().optional(),
});

function extractFromFormData(formData: FormData) {
  return {
    date:         String(formData.get("date") ?? "").trim(),
    name:         String(formData.get("name") ?? "").trim(),
    calendarType: String(formData.get("calendarType") ?? "").trim(),
    description:  String(formData.get("description") ?? "").trim() || undefined,
    isWorkingDay: formData.get("isWorkingDay") === "on" || formData.get("isWorkingDay") === "true",
  };
}

// ── Server actions ─────────────────────────────────────────────────────────────

/**
 * ADMIN or HR_OFFICER — create a new calendar entry.
 */
export async function createCalendarEntry(
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_ATTENDANCE_POLICY", async () => {
    const raw    = extractFromFormData(formData);
    const parsed = calendarEntrySchema.safeParse(raw);

    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid calendar entry values.");
    }

    const entry = await upsertCalendarEntry({
      ...parsed.data,
      createdById: session!.user.id,
    });

    await logAudit(
      "CREATE_CALENDAR_ENTRY",
      "AttendanceCalendar",
      entry.id,
      { date: parsed.data.date, name: parsed.data.name, calendarType: parsed.data.calendarType },
      session!.user.id
    );

    revalidatePath("/attendance/calendar");
    return { id: entry.id };
  });
}

/**
 * ADMIN or HR_OFFICER — update an existing calendar entry.
 */
export async function updateCalendarEntry(
  id: string,
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_ATTENDANCE_POLICY", async () => {
    const raw    = extractFromFormData(formData);
    const parsed = calendarEntrySchema.safeParse(raw);

    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid calendar entry values.");
    }

    const entry = await upsertCalendarEntry({
      ...parsed.data,
      createdById: session!.user.id,
    });

    await logAudit(
      "UPDATE_CALENDAR_ENTRY",
      "AttendanceCalendar",
      id,
      { date: parsed.data.date, name: parsed.data.name, calendarType: parsed.data.calendarType },
      session!.user.id
    );

    revalidatePath("/attendance/calendar");
    return { id: entry.id };
  });
}

/**
 * ADMIN or HR_OFFICER — delete a calendar entry.
 */
export async function deleteCalendarEntry(
  id: string
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_ATTENDANCE_POLICY", async () => {
    await deleteCalendarEntryQuery(id);

    await logAudit(
      "DELETE_CALENDAR_ENTRY",
      "AttendanceCalendar",
      id,
      { deletedId: id },
      session!.user.id
    );

    revalidatePath("/attendance/calendar");
    return { id };
  });
}
