/**
 * Attendance policy engine — the single authoritative place where attendance
 * status is calculated from a check-in timestamp and the active policy.
 *
 * Rules enforced here:
 *   - Before/within grace period after work-start → PRESENT
 *   - After grace period, before half-day threshold (if set) → LATE
 *   - At or after half-day threshold (if set) → HALF_DAY
 *
 * Historical integrity: status is calculated at check-in time and stored in
 * the Attendance row. A future policy change does NOT recalculate past records.
 *
 * No status is ever accepted from the client — callers supply only the
 * server-generated check-in timestamp and the loaded policy.
 */

import { getOrgLocalDateString } from "@/lib/attendance-date";

// ── Default policy (used when no DB row exists yet) ───────────────────────

export const DEFAULT_POLICY = {
  workStartTime:          "08:00",
  workEndTime:            "17:00",
  gracePeriodMinutes:     15,
  halfDayThresholdMinutes: null as number | null,
  workingDays:            [1, 2, 3, 4, 5], // Mon–Fri
  isActive:               true,
} as const;

export type PolicyValues = {
  workStartTime:           string;       // "HH:MM"
  workEndTime:             string;       // "HH:MM"
  gracePeriodMinutes:      number;
  halfDayThresholdMinutes: number | null;
  workingDays:             number[];     // ISO weekday 1=Mon … 7=Sun
  isActive:                boolean;
};

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

// ── Core status evaluator ─────────────────────────────────────────────────

export type AttendanceStatusResult =
  | "PRESENT"
  | "LATE"
  | "HALF_DAY"
  | "ABSENT"
  | "ON_LEAVE";

/**
 * Determines the attendance status for a given check-in time against the
 * active policy. Called at check-in time — the result is stored permanently
 * and never recalculated when the policy changes.
 *
 * @param checkInUtc   The UTC timestamp of the check-in (server-generated).
 * @param policy       The active attendance policy.
 * @param dateStr      The org-local attendance date ("YYYY-MM-DD"), used to
 *                     verify the check-in is on a working day.
 */
export function evaluateCheckInStatus(
  checkInUtc: Date,
  policy: PolicyValues,
  dateStr: string
): AttendanceStatusResult {
  const workStartMinutes    = parseTimeToMinutes(policy.workStartTime);
  const graceCutoff         = workStartMinutes + policy.gracePeriodMinutes;
  const halfDayCutoff       =
    policy.halfDayThresholdMinutes != null
      ? graceCutoff + policy.halfDayThresholdMinutes
      : null;

  const checkInMinutes = utcDateToOrgMinutesSinceMidnight(checkInUtc);

  // Within work-start + grace period → PRESENT
  if (checkInMinutes <= graceCutoff) return "PRESENT";

  // After grace, check for half-day threshold
  if (halfDayCutoff !== null && checkInMinutes >= halfDayCutoff) return "HALF_DAY";

  // Otherwise → LATE
  return "LATE";
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
  workStartTime: string;
  workEndTime: string;
  gracePeriodMinutes: number;
  halfDayThresholdMinutes: number | null;
  workingDays: string;
  isActive: boolean;
}): PolicyValues {
  let workingDays: number[];
  try {
    const parsed = JSON.parse(row.workingDays);
    workingDays = Array.isArray(parsed) ? parsed.filter((n) => typeof n === "number") : [1, 2, 3, 4, 5];
  } catch {
    workingDays = [1, 2, 3, 4, 5];
  }

  return {
    workStartTime:           row.workStartTime,
    workEndTime:             row.workEndTime,
    gracePeriodMinutes:      Math.max(0, row.gracePeriodMinutes),
    halfDayThresholdMinutes: row.halfDayThresholdMinutes,
    workingDays,
    isActive:                row.isActive,
  };
}
