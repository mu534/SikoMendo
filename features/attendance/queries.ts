import "server-only";
import prisma from "@/lib/prisma";
import { parseDateOnly } from "@/lib/attendance-date";
import type { AttendanceStatus, AttendanceSession, Prisma } from "@prisma/client";

// Re-export so existing callers that import parseDateOnly from this file continue to work.
export { parseDateOnly };

// ── Admin: full daily register ───────────────────────────────────────────────

export async function getDailyRegister({ date, status }: { date: string; status?: string }) {
  const dateValue = parseDateOnly(date);

  const employees = await prisma.employee.findMany({
    where: {
      deletedAt: null,
      employmentStatus: "ACTIVE",
    },
    include: {
      attendances: { where: { date: dateValue } },
      department: { select: { name: true } },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  const summary = buildSummary(employees);

  const filteredEmployees = status
    ? employees.filter((emp) => {
        // Status filter uses day-level status (precedence: ON_LEAVE > any PRESENT > all ABSENT)
        const dayStatus = getDayStatus(emp.attendances);
        if (status === "UNMARKED") return emp.attendances.length === 0;
        return dayStatus === status;
      })
    : employees;

  return { employees: filteredEmployees, summary, dateValue };
}

// ── Manager: scoped daily register (read-only) ───────────────────────────────

/**
 * Returns the daily register scoped to a specific set of employee IDs.
 * Used by the Manager view to show only their reporting hierarchy.
 *
 * Security: the allowedIds list is derived server-side from the manager's
 * own employee record — never from client input.
 */
export async function getDailyRegisterScoped({
  date,
  status,
  allowedIds,
}: {
  date: string;
  status?: string;
  allowedIds: string[];
}) {
  if (allowedIds.length === 0) {
    const empty = { present: 0, absent: 0, late: 0, halfDay: 0, excused: 0, onLeave: 0, unmarked: 0 };
    return { employees: [], summary: empty, dateValue: parseDateOnly(date) };
  }

  const dateValue = parseDateOnly(date);

  const employees = await prisma.employee.findMany({
    where: {
      id: { in: allowedIds },
      deletedAt: null,
      employmentStatus: "ACTIVE",
    },
    include: {
      attendances: { where: { date: dateValue } },
      department: { select: { name: true } },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  const summary = buildSummary(employees);

  const filteredEmployees = status
    ? employees.filter((emp) => {
        const dayStatus = getDayStatus(emp.attendances);
        if (status === "UNMARKED") return emp.attendances.length === 0;
        return dayStatus === status;
      })
    : employees;

  return { employees: filteredEmployees, summary, dateValue };
}

// ── Day-level status helper ───────────────────────────────────────────────────

/**
 * Computes the day-level status for an employee from their session rows.
 *
 * Precedence:
 *   1. ON_LEAVE (any session) → ON_LEAVE
 *   2. HOLIDAY  (any session) → HOLIDAY
 *   3. Full 9-cell morning+afternoon matrix:
 *      PRESENT + PRESENT  → PRESENT
 *      PRESENT + LATE     → LATE
 *      LATE    + PRESENT  → LATE
 *      LATE    + LATE     → LATE
 *      PRESENT + ABSENT   → HALF_DAY
 *      ABSENT  + PRESENT  → HALF_DAY
 *      LATE    + ABSENT   → HALF_DAY
 *      ABSENT  + LATE     → HALF_DAY
 *      ABSENT  + ABSENT   → ABSENT
 *
 * When only one session row exists, treat the missing session as ABSENT.
 */
export function getDayStatus(
  attendances: Array<{ status: string; session?: string }>
): string | null {
  if (attendances.length === 0) return null;
  const statuses = attendances.map((a) => a.status);

  // Highest-precedence overrides
  if (statuses.includes("ON_LEAVE")) return "ON_LEAVE";
  if (statuses.includes("HOLIDAY"))  return "HOLIDAY";

  // Determine per-session status (treat missing session as ABSENT)
  const morningRecord   = attendances.find((a) => a.session === "MORNING")
                       ?? attendances.find((a) => !a.session); // legacy/no-session rows
  const afternoonRecord = attendances.find((a) => a.session === "AFTERNOON");

  const mStatus: string = morningRecord?.status   ?? "ABSENT";
  const aStatus: string = afternoonRecord?.status ?? "ABSENT";

  // Single-session day: when both resolve to the same value and there's only
  // one row, trust that row directly (avoids false HALF_DAY on single-session orgs).
  // The missing-session-as-ABSENT rule applies only when two distinct sessions
  // are distinguishable (i.e., the row has session info).
  if (attendances.length === 1 && !attendances[0]!.session) {
    // Legacy row without session field — fall back to previous simple logic
    const s = statuses[0]!;
    if (s === "EXCUSED") return "EXCUSED";
    if (s === "HALF_DAY") return "HALF_DAY";
    if (s === "LATE") return "LATE";
    if (s === "PRESENT") return "PRESENT";
    return s;
  }

  // Apply 9-cell matrix
  const isPresent = (s: string) => s === "PRESENT";
  const isLate    = (s: string) => s === "LATE";
  const isAbsent  = (s: string) => s === "ABSENT";

  if ((isPresent(mStatus) || isLate(mStatus)) && (isPresent(aStatus) || isLate(aStatus))) {
    // Both sessions attended — LATE if either is late, otherwise PRESENT
    if (isLate(mStatus) || isLate(aStatus)) return "LATE";
    return "PRESENT";
  }

  if (
    (isPresent(mStatus) || isLate(mStatus)) && isAbsent(aStatus) ||
    isAbsent(mStatus) && (isPresent(aStatus) || isLate(aStatus))
  ) {
    return "HALF_DAY";
  }

  if (isAbsent(mStatus) && isAbsent(aStatus)) return "ABSENT";

  // Fallback for EXCUSED or other statuses
  if (statuses.includes("EXCUSED"))  return "EXCUSED";
  if (statuses.includes("HALF_DAY")) return "HALF_DAY";
  return statuses[0] ?? null;
}

// ── Shared summary builder ────────────────────────────────────────────────────

/**
 * Counts distinct employees by day-level status so the summary header remains
 * employee-counted (not session-doubled). Uses getDayStatus precedence.
 */
function buildSummary(
  employees: Array<{ attendances: Array<{ status: string; session?: string }> }>
) {
  const summary = {
    present: 0, absent: 0, late: 0, halfDay: 0,
    excused: 0, onLeave: 0, unmarked: 0, holiday: 0,
  };
  for (const emp of employees) {
    const dayStatus = getDayStatus(emp.attendances);
    if (!dayStatus)                    summary.unmarked++;
    else if (dayStatus === "PRESENT")  summary.present++;
    else if (dayStatus === "ABSENT")   summary.absent++;
    else if (dayStatus === "LATE")     summary.late++;
    else if (dayStatus === "HALF_DAY") summary.halfDay++;
    else if (dayStatus === "EXCUSED")  summary.excused++;
    else if (dayStatus === "ON_LEAVE") summary.onLeave++;
    else if (dayStatus === "HOLIDAY")  summary.holiday++;
  }
  return summary;
}

// ── Self-service: today's own attendance records ──────────────────────────────

/**
 * Returns the authenticated employee's attendance record for the given date and
 * optional session. When session is provided, finds the specific session row.
 * When no session is provided, returns the first row for backward compatibility.
 *
 * Security: `employeeId` must be derived from `session.user.id` by the caller —
 * never accepted from a URL param or form field.
 */
export async function getTodayAttendance(
  employeeId: string,
  todayStr: string,
  session?: AttendanceSession
) {
  const dateValue = parseDateOnly(todayStr);
  if (session) {
    return prisma.attendance.findUnique({
      where: { employeeId_date_session: { employeeId, date: dateValue, session } },
      select: {
        id: true,
        session: true,
        status: true,
        checkIn: true,
        checkOut: true,
        notes: true,
      },
    });
  }
  return prisma.attendance.findFirst({
    where: { employeeId, date: dateValue },
    select: {
      id: true,
      session: true,
      status: true,
      checkIn: true,
      checkOut: true,
      notes: true,
    },
  });
}

/**
 * Returns both session records (morning and afternoon) for an employee on a given date.
 * Used by the self attendance panel to show two session cards.
 */
export async function getTodayAttendanceBoth(employeeId: string, todayStr: string) {
  const dateValue = parseDateOnly(todayStr);
  const rows = await prisma.attendance.findMany({
    where: { employeeId, date: dateValue },
    select: {
      id: true,
      session: true,
      status: true,
      checkIn: true,
      checkOut: true,
      notes: true,
    },
  });
  return {
    morning:   rows.find((r) => r.session === "MORNING")   ?? null,
    afternoon: rows.find((r) => r.session === "AFTERNOON") ?? null,
  };
}

// ── Self-service: own attendance history (paginated) ─────────────────────────

export type MyAttendanceFilters = {
  employeeId: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  page: number;
};

// Doubled from 15 to 30 to preserve ~15 calendar days per page now that two
// session rows render per day (see design §8.3 / Finding 13).
const MY_ATTENDANCE_PAGE_SIZE = 30;

/**
 * Paginated attendance history for one employee.
 * Each record carries its session for the history table's Session column.
 *
 * Security: `employeeId` must always be resolved from the session by the caller.
 */
export async function getMyAttendanceHistory({
  employeeId,
  startDate,
  endDate,
  status,
  page,
}: MyAttendanceFilters) {
  const where: Prisma.AttendanceWhereInput = {
    employeeId,
    ...(startDate || endDate
      ? {
          date: {
            ...(startDate ? { gte: parseDateOnly(startDate) } : {}),
            ...(endDate   ? { lte: parseDateOnly(endDate)   } : {}),
          },
        }
      : {}),
    ...(status ? { status: status as AttendanceStatus } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.attendance.findMany({
      where,
      orderBy: [{ date: "desc" }, { session: "asc" }],
      skip:    (page - 1) * MY_ATTENDANCE_PAGE_SIZE,
      take:    MY_ATTENDANCE_PAGE_SIZE,
    }),
    prisma.attendance.count({ where }),
  ]);

  return { items, total, totalPages: Math.max(1, Math.ceil(total / MY_ATTENDANCE_PAGE_SIZE)) };
}

// ── Self-service: lifetime stats for one employee ────────────────────────────

/**
 * Lifetime attendance statistics for one employee.
 * Counts distinct dates per status to avoid session-doubling.
 * `employeeId` must be derived from the session by the caller.
 */
export async function getMyAttendanceStats(employeeId: string) {
  // Get all rows, roll up per date using day-status precedence
  const rows = await prisma.attendance.findMany({
    where:  { employeeId },
    select: { date: true, status: true },
  });

  // Group by date
  const byDate = new Map<string, string[]>();
  for (const r of rows) {
    const dateKey = r.date.toISOString().slice(0, 10);
    const arr = byDate.get(dateKey) ?? [];
    arr.push(r.status);
    byDate.set(dateKey, arr);
  }

  let present = 0, late = 0, halfDay = 0, absent = 0, onLeave = 0, totalDays = 0;
  for (const statuses of byDate.values()) {
    totalDays++;
    const ds = getDayStatus(statuses.map((s) => ({ status: s })));
    if (ds === "PRESENT")  present++;
    else if (ds === "LATE")      late++;
    else if (ds === "HALF_DAY")  halfDay++;
    else if (ds === "ABSENT")    absent++;
    else if (ds === "ON_LEAVE")  onLeave++;
  }

  const totalWorkingDays = present + late + halfDay;
  const countedDays = totalDays - onLeave;

  return {
    totalWorkingDays,
    lateArrivals: late,
    absences: absent,
    attendanceRate:
      countedDays > 0 ? Math.round((totalWorkingDays / countedDays) * 100) : null,
  };
}

/**
 * Monthly attendance summary for a single employee — used on the employee
 * profile Attendance tab. Returns counts broken down by status for the
 * requested calendar month. Counts distinct dates per status to avoid doubling.
 *
 * Security: `employeeId` must be resolved from the session / hierarchy check
 * by the caller — this query trusts whatever value it receives.
 */
export async function getEmployeeMonthlyAttendance(
  employeeId: string,
  year: number,
  month: number // 1-based
) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end   = new Date(Date.UTC(year, month, 0, 23, 59, 59)); // last day of month

  const records = await prisma.attendance.findMany({
    where:   { employeeId, date: { gte: start, lte: end } },
    orderBy: [{ date: "desc" }, { session: "asc" }],
    select:  {
      id: true,
      date: true,
      session: true,
      status: true,
      checkIn: true,
      checkOut: true,
      notes: true,
    },
  });

  // Roll up per date to avoid doubling
  const byDate = new Map<string, string[]>();
  for (const r of records) {
    const dateKey = r.date.toISOString().slice(0, 10);
    const arr = byDate.get(dateKey) ?? [];
    arr.push(r.status);
    byDate.set(dateKey, arr);
  }

  const counts = { present: 0, late: 0, halfDay: 0, absent: 0, onLeave: 0, excused: 0 };
  for (const statuses of byDate.values()) {
    const ds = getDayStatus(statuses.map((s) => ({ status: s })));
    if (ds === "PRESENT")       counts.present++;
    else if (ds === "LATE")     counts.late++;
    else if (ds === "HALF_DAY") counts.halfDay++;
    else if (ds === "ABSENT")   counts.absent++;
    else if (ds === "ON_LEAVE") counts.onLeave++;
    else if (ds === "EXCUSED")  counts.excused++;
  }

  return { records, counts };
}
