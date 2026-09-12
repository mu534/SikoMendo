/**
 * Org-local date helpers for attendance.
 *
 * Siko Mendo operates in Ethiopia (East Africa Time, UTC+3).
 * Ethiopia does not observe daylight saving time, so the offset is always +3 h.
 *
 * ALL attendance date logic must go through these helpers so that:
 *   - "Today" means the organisation's local calendar date, not the server's TZ.
 *   - Check-in/check-out timestamps remain absolute UTC values in the DB.
 *   - The attendance `date` column (@db.Date, stored as midnight UTC) correctly
 *     represents the organisation's local date — parseDateOnly("YYYY-MM-DD")
 *     returns new Date("YYYY-MM-DDT00:00:00.000Z") which matches DB storage.
 *
 * If the organisation moves to a configurable timezone in the future, change
 * ORG_UTC_OFFSET_HOURS here and all attendance date logic updates automatically.
 */

/** UTC+3 (East Africa Time). Ethiopia has no DST. */
const ORG_UTC_OFFSET_HOURS = 3;

/**
 * Returns today's date string in the organisation's local timezone ("YYYY-MM-DD").
 *
 * Uses the server's wall-clock UTC time shifted by the org offset — never the
 * server machine's local timezone, never a browser value.
 */
export function getOrgLocalDateString(): string {
  const nowUtcMs = Date.now();
  const orgOffsetMs = ORG_UTC_OFFSET_HOURS * 60 * 60 * 1000;
  // Shift the UTC epoch to org-local, then extract the ISO date portion.
  return new Date(nowUtcMs + orgOffsetMs).toISOString().slice(0, 10);
}

/**
 * Returns the current wall-clock time as an absolute UTC Date.
 * Always generated on the server — never accepted from the client.
 */
export function getServerNow(): Date {
  return new Date();
}

/**
 * Converts a "YYYY-MM-DD" attendance date string to the midnight-UTC Date that
 * Prisma stores in the @db.Date column.
 *
 * This is the single canonical implementation — callers in attendance actions
 * and queries should import this rather than inlining `new Date(...)`.
 */
export function parseDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/**
 * Formats a UTC Date as "HH:mm" in the org's local timezone, for display.
 * Used by the self-attendance panel to show check-in/check-out times.
 */
export function formatTimeInOrgTz(date: Date): string {
  const shifted = new Date(date.getTime() + ORG_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  return shifted.toISOString().slice(11, 16); // "HH:mm"
}
