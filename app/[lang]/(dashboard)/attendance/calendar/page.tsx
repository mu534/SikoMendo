import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/session";
import { listCalendarEntries } from "@/features/attendance/calendar-queries";
import { CalendarPageClient } from "@/features/attendance/calendar-page-client";

/**
 * Attendance Calendar Management — Admin and HR Officer (MANAGE_ATTENDANCE_POLICY).
 *
 * Displays all calendar entries (public holidays, religious holidays,
 * org-specific non-working and special working days). Provides add/edit/delete
 * actions accessible to ADMIN and HR_OFFICER only.
 */
export default async function AttendanceCalendarPage() {
  await requirePermission("MANAGE_ATTENDANCE_POLICY");

  const t = await getTranslations("attendance");

  const entries = await listCalendarEntries();

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">
          {t("calendarTitle")}
        </h2>
        <p className="mt-1 text-sm text-ink-900/60">
          Manage public holidays, religious holidays, and special non-working days.
          Absence detection skips dates marked as non-working.
        </p>
      </div>

      <CalendarPageClient entries={entries} />
    </div>
  );
}
