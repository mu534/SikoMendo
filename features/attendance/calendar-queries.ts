import "server-only";
import prisma from "@/lib/prisma";
import { parseDateOnly } from "@/lib/attendance-date";
import type { CalendarType } from "@prisma/client";

export type { CalendarType };

// ── List ──────────────────────────────────────────────────────────────────────

/** Returns all calendar entries, ordered by date descending. */
export async function listCalendarEntries() {
  return prisma.attendanceCalendar.findMany({
    orderBy: { date: "desc" },
    include: { createdBy: { select: { name: true } } },
  });
}

// ── Get single ────────────────────────────────────────────────────────────────

/** Returns a single calendar entry by its id, or null if not found. */
export async function getCalendarEntry(id: string) {
  return prisma.attendanceCalendar.findUnique({
    where: { id },
    include: { createdBy: { select: { name: true } } },
  });
}

// ── Upsert ────────────────────────────────────────────────────────────────────

/**
 * Upserts a calendar entry by date.
 * If an entry for the given date already exists it is updated; otherwise a new
 * one is created.
 */
export async function upsertCalendarEntry(data: {
  date: string;          // "YYYY-MM-DD"
  name: string;
  calendarType: CalendarType;
  description?: string;
  isWorkingDay?: boolean;
  createdById?: string;
}) {
  const dateValue = parseDateOnly(data.date);

  return prisma.attendanceCalendar.upsert({
    where: { date: dateValue },
    create: {
      date:         dateValue,
      name:         data.name,
      calendarType: data.calendarType,
      description:  data.description ?? null,
      isWorkingDay: data.isWorkingDay ?? false,
      createdById:  data.createdById ?? null,
    },
    update: {
      name:         data.name,
      calendarType: data.calendarType,
      description:  data.description ?? null,
      isWorkingDay: data.isWorkingDay ?? false,
    },
  });
}

// ── Delete ────────────────────────────────────────────────────────────────────

/** Deletes a calendar entry by id. */
export async function deleteCalendarEntry(id: string) {
  return prisma.attendanceCalendar.delete({ where: { id } });
}

// ── Holiday check ─────────────────────────────────────────────────────────────

/**
 * Returns true when there is a calendar entry for `dateStr` where
 * `isWorkingDay` is false (i.e., the date is a non-working holiday).
 *
 * Absence detection calls this after confirming the date is a weekday working
 * day per policy, so SPECIAL_WORKING entries (isWorkingDay = true) are ignored.
 */
export async function isHolidayDate(dateStr: string): Promise<boolean> {
  const dateValue = parseDateOnly(dateStr);
  const entry = await prisma.attendanceCalendar.findUnique({
    where: { date: dateValue },
    select: { isWorkingDay: true },
  });
  if (!entry) return false;
  return entry.isWorkingDay === false;
}
