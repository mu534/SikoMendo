/**
 * Attendance policy engine — the single authoritative place where attendance
 * status is calculated from a check-in timestamp and the active policy.
 *
 * Rules enforced here (two-session model with grace period):
 *   - Check-in at or before the session deadline                → PRESENT
 *   - Check-in after deadline but within graceMinutes           → LATE
 *   - Check-in after deadline + graceMinutes                    → ABSENT
 *
 * Auto-absence detection fires at deadline + graceMinutes, so employees who
 * arrive during the grace window are marked LATE — never wrongly auto-ABSENT.
 *
 * Session routing:
 *   - EAT time strictly before afternoonStartTime → MORNING
 *   - EAT time at or after afternoonStartTime → AFTERNOON
 *
 * Historical integrity: status is calculated at check-in time and stored in
 * the Attendance row. A future policy change does NOT recalculate past records.
 *
 * No status is ever accepted from the client — callers supply only the
 * server-generated check-in timestamp and the loaded policy.
 */

import { getOrgLocalDateString } from "@/lib/attendance-date";

// ── Default policy (used when no DB row exists yet) ───────────────────────

export const DEFAULT_POLICY: PolicyValues = {
  morningStartTime:         "08:00",
  morningCheckInDeadline:   "08:15",
  afternoonStartTime:       "13:00",
  afternoonCheckInDeadline: "13:15",
  morningGraceMinutes:      15,
  afternoonGraceMinutes:    15,
  workingDays:              [1, 2, 3, 4, 5],
  isActive:                 true,
};

export type PolicyValues = {
  morningStartTime:         string; // "HH:MM"
  morningCheckInDeadline:   string; // "HH:MM"
  afternoonStartTime:       string; // "HH:MM"
  afternoonCheckInDeadline: string; // "HH:MM"
  morningGraceMinutes:      number; // grace period (minutes) for the morning session
  afternoonGraceMinutes:    number; // grace period (minutes) for the afternoon session
  /** @deprecated Use morningGraceMinutes / afternoonGraceMinutes instead. */
  graceMinutes?:            number;
  workingDays:              number[]; // ISO weekday 1=Mon … 7=Sun
  isActive:                 boolean;
};

export type AttendanceSession = "MORNING" | "AFTERNOON";

// ── Time helpers ──────────────────────────────────────────────────────────

/** Parses a "HH:MM" string into total minutes since midnight. */
export function parseTimeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** EAT offset in milliseconds (UTC+3, no DST). */
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * Returns the number of minutes since midnight in the org's local timezone
 * for the given UTC Date.
 */
export function utcDateToOrgMinutesSinceMidnight(utcDate: Date): number {
  const localMs = utcDate.getTime() + EAT_OFFSET_MS;
  const localDate = new Date(localMs);
  return localDate.getUTCHours() * 60 + localDate.getUTCMinutes();
}

/**
 * Returns the ISO weekday (1=Mon … 7=Sun) of the org-local date string
 * "YYYY-MM-DD".
 */
export function orgDateWeekday(dateStr: string): number {
  // parseDateOnly gives midnight-UTC which is the correct date
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  // getUTCDay(): 0=Sun, 1=Mon … 6=Sat → convert to ISO (1=Mon … 7=Sun)
  const dow = d.getUTCDay();
  return dow === 0 ? 7 : dow;
}

// ── Session routing ───────────────────────────────────────────────────────

/**
 * Routes a check-in timestamp to a session by time of day (EAT).
 * EAT time strictly before afternoonStartTime → MORNING; otherwise → AFTERNOON.
 * A check-in exactly at afternoonStartTime belongs to AFTERNOON.
 */
export function routeCheckInToSession(
  checkInUtc: Date,
  policy: PolicyValues
): AttendanceSession {
  const afternoonStartMin = parseTimeToMinutes(policy.afternoonStartTime);
  return utcDateToOrgMinutesSinceMidnight(checkInUtc) < afternoonStartMin
    ? "MORNING"
    : "AFTERNOON";
}

// ── Core status evaluator ─────────────────────────────────────────────────

export type AttendanceStatusResult = "PRESENT" | "ABSENT" | "ON_LEAVE";

/**
 * Per-session status evaluation with grace period (FR-2.1).
 *
 * Check-in at or before deadline                   → PRESENT
 * Check-in after deadline, within graceMinutes     → LATE
 * Check-in after deadline + graceMinutes           → ABSENT
 *
 * @param checkInUtc  The UTC timestamp of the check-in (server-generated).
 * @param policy      The active attendance policy.
 * @param session     The session to evaluate against.
 */
export function evaluateSessionCheckIn(
  checkInUtc: Date,
  policy: PolicyValues,
  session: AttendanceSession
): "PRESENT" | "LATE" | "ABSENT" {
  const checkInMin = utcDateToOrgMinutesSinceMidnight(checkInUtc);
  const deadlineMin = parseTimeToMinutes(
    session === "MORNING"
      ? policy.morningCheckInDeadline
      : policy.afternoonCheckInDeadline
  );
  const graceMin = session === "MORNING"
    ? policy.morningGraceMinutes
    : policy.afternoonGraceMinutes;
  if (checkInMin <= deadlineMin) return "PRESENT";
  if (checkInMin <= deadlineMin + graceMin) return "LATE";
  return "ABSENT";
}

/**
 * Returns the EAT minutes-since-midnight at which auto-absence detection
 * should fire for a given session: deadline + graceMinutes.
 * The tick route compares nowMin against this threshold.
 */
export function detectionThresholdMinutes(
  policy: PolicyValues,
  session: AttendanceSession
): number {
  const deadlineMin = parseTimeToMinutes(
    session === "MORNING"
      ? policy.morningCheckInDeadline
      : policy.afternoonCheckInDeadline
  );
  const graceMin = session === "MORNING"
    ? policy.morningGraceMinutes
    : policy.afternoonGraceMinutes;
  return deadlineMin + graceMin;
}

/**
 * Returns true if `dateStr` is a configured working day per the policy.
 * Used to decide whether to create an attendance record at all on non-working days.
 */
export function isWorkingDay(dateStr: string, policy: PolicyValues): boolean {
  const weekday = orgDateWeekday(dateStr);
  return policy.workingDays.includes(weekday);
}

/**
 * Returns today's org-local date string and whether it is a working day.
 */
export function getTodayWorkingDayInfo(policy: PolicyValues): {
  todayStr: string;
  isWorking: boolean;
} {
  const todayStr = getOrgLocalDateString();
  return { todayStr, isWorking: isWorkingDay(todayStr, policy) };
}

// ── Policy deserialiser ───────────────────────────────────────────────────

/**
 * Converts a raw DB AttendancePolicy row into the canonical PolicyValues shape,
 * with safe fallbacks for missing/corrupt data.
 */
export function normalisePolicyRow(row: {
  morningStartTime:         string;
  morningCheckInDeadline:   string;
  afternoonStartTime:       string;
  afternoonCheckInDeadline: string;
  morningGraceMinutes:      number;
  afternoonGraceMinutes:    number;
  graceMinutes?:            number | null;
  workingDays:              string;
  isActive:                 boolean;
}): PolicyValues {
  let workingDays: number[];
  try {
    const parsed = JSON.parse(row.workingDays);
    workingDays = Array.isArray(parsed)
      ? parsed.filter((n) => typeof n === "number")
      : [1, 2, 3, 4, 5];
  } catch {
    workingDays = [1, 2, 3, 4, 5];
  }

  return {
    morningStartTime:         row.morningStartTime,
    morningCheckInDeadline:   row.morningCheckInDeadline,
    afternoonStartTime:       row.afternoonStartTime,
    afternoonCheckInDeadline: row.afternoonCheckInDeadline,
    morningGraceMinutes:      Math.max(0, row.morningGraceMinutes ?? row.graceMinutes ?? 15),
    afternoonGraceMinutes:    Math.max(0, row.afternoonGraceMinutes ?? row.graceMinutes ?? 15),
    workingDays,
    isActive:                 row.isActive,
  };
}
