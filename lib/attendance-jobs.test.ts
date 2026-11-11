/**
 * Unit tests for lib/attendance-jobs.ts — session-aware two-session model.
 *
 * All Prisma calls and external dependencies are mocked — no DB required.
 * Covers all 10 required test scenarios (§10.1 of the design).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (must be declared before the module under test is imported) ─────

vi.mock("@/lib/prisma", () => ({
  default: {
    employee: { findMany: vi.fn() },
    attendance: { findMany: vi.fn(), createMany: vi.fn(), updateMany: vi.fn() },
    leaveRequest: { findMany: vi.fn() },
    auditLog: { createMany: vi.fn() },
    user: { findMany: vi.fn() },
    attendancePolicy: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn(),
}));

vi.mock("@/lib/session",  () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth",     () => ({ auth: {} }));

// ── Imports ───────────────────────────────────────────────────────────────

import prisma from "@/lib/prisma";
import { runAbsenceDetection, runAbsenceFinalization } from "@/lib/attendance-jobs";

// ── Helpers ───────────────────────────────────────────────────────────────

const MONDAY = "2026-01-12"; // ISO weekday 1 (Mon) — working day per default policy
const SUNDAY = "2026-01-18"; // ISO weekday 7 (Sun) — non-working per default policy

/** Default policy row returned by attendancePolicy.findUnique mock. */
const DEFAULT_POLICY_ROW = {
  id: "singleton",
  morningStartTime:         "08:00",
  morningCheckInDeadline:   "08:15",
  afternoonStartTime:       "13:00",
  afternoonCheckInDeadline: "13:15",
  graceMinutes:             15,
  workingDays: "[1,2,3,4,5]",
  isActive: true,
  updatedAt: new Date(),
  updatedById: null,
};

/** A mock UTC check-in time at 08:05 EAT (05:05 UTC) — before morning deadline → PRESENT. */
const CHECK_IN_MORNING_PRESENT = new Date("2026-01-12T05:05:00.000Z"); // 08:05 EAT

/** A mock UTC check-in time at 08:20 EAT (05:20 UTC) — after morning deadline, within grace → LATE. */
const CHECK_IN_MORNING_LATE = new Date("2026-01-12T05:20:00.000Z"); // 08:20 EAT

/** A mock UTC check-in time at 08:45 EAT (05:45 UTC) — past deadline + 15 min grace → ABSENT. */
const CHECK_IN_MORNING_ABSENT = new Date("2026-01-12T05:45:00.000Z"); // 08:45 EAT

/** A mock UTC check-in time at 13:10 EAT (10:10 UTC) — before afternoon deadline → PRESENT. */
const CHECK_IN_AFTERNOON_PRESENT = new Date("2026-01-12T10:10:00.000Z"); // 13:10 EAT

/** A mock UTC check-in time at 13:20 EAT (10:20 UTC) — after afternoon deadline, within grace → LATE. */
const CHECK_IN_AFTERNOON_LATE = new Date("2026-01-12T10:20:00.000Z"); // 13:20 EAT

/** A mock UTC check-in time at 13:45 EAT (10:45 UTC) — past afternoon deadline + 15 min grace → ABSENT. */
const CHECK_IN_AFTERNOON_ABSENT = new Date("2026-01-12T10:45:00.000Z"); // 13:45 EAT

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.attendancePolicy.findUnique).mockResolvedValue(DEFAULT_POLICY_ROW as never);
  vi.mocked(prisma.user.findMany).mockResolvedValue([]);
  vi.mocked(prisma.attendance.createMany).mockResolvedValue({ count: 0 });
  vi.mocked(prisma.attendance.updateMany).mockResolvedValue({ count: 0 });
  vi.mocked(prisma.auditLog.createMany).mockResolvedValue({ count: 0 });
  vi.mocked(prisma.leaveRequest.findMany).mockResolvedValue([]);
});

// ── Scenario 1: check-in before morning deadline → PRESENT ────────────────
// (via evaluateSessionCheckIn — tested directly in attendance-policy.test.ts)

describe("Scenario 1: evaluateSessionCheckIn — before morning deadline → PRESENT", () => {
  it("08:05 EAT (before morning deadline 08:15) → PRESENT", async () => {
    const { evaluateSessionCheckIn, DEFAULT_POLICY } = await import("@/lib/attendance-policy");
    const status = evaluateSessionCheckIn(CHECK_IN_MORNING_PRESENT, DEFAULT_POLICY, "MORNING");
    expect(status).toBe("PRESENT");
  });
});

// ── Scenario 2: check-in within grace → LATE; past grace → ABSENT ──────────

describe("Scenario 2: check-in after morning deadline with grace period", () => {
  it("08:20 EAT (after deadline 08:15, within 15-min grace) → LATE", async () => {
    const { evaluateSessionCheckIn, DEFAULT_POLICY } = await import("@/lib/attendance-policy");
    const status = evaluateSessionCheckIn(CHECK_IN_MORNING_LATE, DEFAULT_POLICY, "MORNING");
    expect(status).toBe("LATE");
  });

  it("08:45 EAT (past deadline + grace, 08:15 + 15 min = 08:30) → ABSENT", async () => {
    const { evaluateSessionCheckIn, DEFAULT_POLICY } = await import("@/lib/attendance-policy");
    const status = evaluateSessionCheckIn(CHECK_IN_MORNING_ABSENT, DEFAULT_POLICY, "MORNING");
    expect(status).toBe("ABSENT");
  });
});

// ── Scenario 3: morning no-show → ABSENT created by detection ─────────────

describe("Scenario 3 (AC-9): employee never checks in for morning → ABSENT auto-created", () => {
  it("calls createMany with MORNING, ABSENT, autoRecorded=true; returns markedAbsent=1", async () => {
    const employeeId = "emp-morning-noshow";

    vi.mocked(prisma.employee.findMany).mockResolvedValue([
      { id: employeeId, attendances: [], leaveRequests: [] } as never,
    ]);
    vi.mocked(prisma.attendance.createMany).mockResolvedValue({ count: 1 });

    const result = await runAbsenceDetection(MONDAY, "MORNING");

    expect(prisma.attendance.createMany).toHaveBeenCalledOnce();
    const call = vi.mocked(prisma.attendance.createMany).mock.calls[0]![0]!;
    expect(call.skipDuplicates).toBe(true);
    const dataArr = Array.isArray(call.data) ? call.data : [call.data];
    expect(dataArr).toHaveLength(1);
    expect(dataArr[0]).toMatchObject({
      employeeId,
      session:      "MORNING",
      status:       "ABSENT",
      autoRecorded: true,
    });

    expect(result.markedAbsent).toBe(1);
    expect(result.session).toBe("MORNING");
    expect(result.skippedNonWorkingDay).toBe(false);
  });
});

// ── Scenario 4: check-in before afternoon deadline → PRESENT ──────────────

describe("Scenario 4: evaluateSessionCheckIn — before afternoon deadline → PRESENT", () => {
  it("13:10 EAT (before afternoon deadline 13:15) → PRESENT", async () => {
    const { evaluateSessionCheckIn, DEFAULT_POLICY } = await import("@/lib/attendance-policy");
    const status = evaluateSessionCheckIn(CHECK_IN_AFTERNOON_PRESENT, DEFAULT_POLICY, "AFTERNOON");
    expect(status).toBe("PRESENT");
  });
});

// ── Scenario 5: check-in after afternoon deadline ─────────────────────────

describe("Scenario 5: check-in after afternoon deadline with grace period", () => {
  it("13:20 EAT (after deadline 13:15, within 15-min grace) → LATE", async () => {
    const { evaluateSessionCheckIn, DEFAULT_POLICY } = await import("@/lib/attendance-policy");
    const status = evaluateSessionCheckIn(CHECK_IN_AFTERNOON_LATE, DEFAULT_POLICY, "AFTERNOON");
    expect(status).toBe("LATE");
  });

  it("13:45 EAT (past deadline + grace, 13:15 + 15 min = 13:30) → ABSENT", async () => {
    const { evaluateSessionCheckIn, DEFAULT_POLICY } = await import("@/lib/attendance-policy");
    const status = evaluateSessionCheckIn(CHECK_IN_AFTERNOON_ABSENT, DEFAULT_POLICY, "AFTERNOON");
    expect(status).toBe("ABSENT");
  });
});

// ── Scenario 6: attends morning, misses afternoon ─────────────────────────

describe("Scenario 6 (AC-12): attends morning, misses afternoon — sessions are independent", () => {
  it("morning detection skips employee who has morning row; afternoon detection creates afternoon ABSENT", async () => {
    const employeeId = "emp-morning-only";

    // Morning detection: employee already has a morning row (checked in) → skipped
    vi.mocked(prisma.employee.findMany).mockResolvedValue([
      {
        id: employeeId,
        attendances: [{ id: "att-morning", checkIn: CHECK_IN_MORNING_PRESENT }],
        leaveRequests: [],
      } as never,
    ]);

    const morningResult = await runAbsenceDetection(MONDAY, "MORNING");
    expect(prisma.attendance.createMany).not.toHaveBeenCalled();
    expect(morningResult.markedAbsent).toBe(0);

    vi.clearAllMocks();
    vi.mocked(prisma.attendancePolicy.findUnique).mockResolvedValue(DEFAULT_POLICY_ROW as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);
    vi.mocked(prisma.attendance.createMany).mockResolvedValue({ count: 1 });

    // Afternoon detection: employee has NO afternoon row → marked absent
    vi.mocked(prisma.employee.findMany).mockResolvedValue([
      {
        id: employeeId,
        attendances: [], // no afternoon row
        leaveRequests: [],
      } as never,
    ]);

    const afternoonResult = await runAbsenceDetection(MONDAY, "AFTERNOON");
    expect(prisma.attendance.createMany).toHaveBeenCalledOnce();
    const call = vi.mocked(prisma.attendance.createMany).mock.calls[0]![0]!;
    const dataArr = Array.isArray(call.data) ? call.data : [call.data];
    expect(dataArr[0]).toMatchObject({ session: "AFTERNOON", status: "ABSENT" });
    expect(afternoonResult.markedAbsent).toBe(1);
  });
});

// ── Scenario 7: attends afternoon, misses morning ─────────────────────────

describe("Scenario 7 (AC-13): attends afternoon, misses morning — sessions are independent", () => {
  it("morning detection creates ABSENT; afternoon detection skips employee with afternoon row", async () => {
    const employeeId = "emp-afternoon-only";

    // Morning detection: employee has NO morning row → marked absent
    vi.mocked(prisma.employee.findMany).mockResolvedValue([
      {
        id: employeeId,
        attendances: [], // no morning row
        leaveRequests: [],
      } as never,
    ]);
    vi.mocked(prisma.attendance.createMany).mockResolvedValue({ count: 1 });

    const morningResult = await runAbsenceDetection(MONDAY, "MORNING");
    const morningCall = vi.mocked(prisma.attendance.createMany).mock.calls[0]![0]!;
    const morningData = Array.isArray(morningCall.data) ? morningCall.data : [morningCall.data];
    expect(morningData[0]).toMatchObject({ session: "MORNING", status: "ABSENT" });
    expect(morningResult.markedAbsent).toBe(1);

    vi.clearAllMocks();
    vi.mocked(prisma.attendancePolicy.findUnique).mockResolvedValue(DEFAULT_POLICY_ROW as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);
    vi.mocked(prisma.attendance.createMany).mockResolvedValue({ count: 0 });

    // Afternoon detection: employee has afternoon row → skipped
    vi.mocked(prisma.employee.findMany).mockResolvedValue([
      {
        id: employeeId,
        attendances: [{ id: "att-afternoon", checkIn: CHECK_IN_AFTERNOON_PRESENT }],
        leaveRequests: [],
      } as never,
    ]);

    const afternoonResult = await runAbsenceDetection(MONDAY, "AFTERNOON");
    expect(prisma.attendance.createMany).not.toHaveBeenCalled();
    expect(afternoonResult.markedAbsent).toBe(0);
  });
});

// ── Scenario 8: approved leave → not marked absent (AC-14) ───────────────

describe("Scenario 8 (AC-14): employee with approved leave → not marked absent", () => {
  it("does not include leave-covered employees in createMany for either session", async () => {
    vi.mocked(prisma.employee.findMany).mockResolvedValue([
      {
        id: "emp-on-leave",
        attendances: [],
        leaveRequests: [{ id: "lr-1" }],
      } as never,
    ]);

    const morningResult  = await runAbsenceDetection(MONDAY, "MORNING");
    const afternoonResult = await runAbsenceDetection(MONDAY, "AFTERNOON");

    expect(prisma.attendance.createMany).not.toHaveBeenCalled();
    expect(morningResult.markedAbsent).toBe(0);
    expect(afternoonResult.markedAbsent).toBe(0);
  });
});

// ── Scenario 9: archived/inactive employee → skipped (AC-15) ─────────────

describe("Scenario 9 (AC-15): archived or inactive employee → not processed", () => {
  it("employee.findMany returns [] (filtered by DB where clause) → no createMany called", async () => {
    // The WHERE clause includes deletedAt:null and employmentStatus:'ACTIVE',
    // so archived/inactive employees are never returned. Mock simulates that.
    vi.mocked(prisma.employee.findMany).mockResolvedValue([]);

    const morningResult  = await runAbsenceDetection(MONDAY, "MORNING");
    const afternoonResult = await runAbsenceDetection(MONDAY, "AFTERNOON");

    expect(prisma.attendance.createMany).not.toHaveBeenCalled();
    expect(morningResult.markedAbsent).toBe(0);
    expect(afternoonResult.markedAbsent).toBe(0);
  });
});

// ── Scenario 10: detection runs twice → no duplicates (AC-16) ────────────

describe("Scenario 10 (AC-16): detection job runs more than once → idempotent", () => {
  it("second run short-circuits (employee already has a row) with skipDuplicates:true", async () => {
    const employeeId = "emp-idempotent";

    // First run: no row → creates absent row
    vi.mocked(prisma.employee.findMany).mockResolvedValue([
      { id: employeeId, attendances: [], leaveRequests: [] } as never,
    ]);
    vi.mocked(prisma.attendance.createMany).mockResolvedValue({ count: 1 });

    const firstResult = await runAbsenceDetection(MONDAY, "MORNING");
    expect(firstResult.markedAbsent).toBe(1);

    vi.clearAllMocks();
    vi.mocked(prisma.attendancePolicy.findUnique).mockResolvedValue(DEFAULT_POLICY_ROW as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);
    vi.mocked(prisma.attendance.createMany).mockResolvedValue({ count: 0 });

    // Second run: employee now has a row (auto-absent row was created) → short-circuits
    vi.mocked(prisma.employee.findMany).mockResolvedValue([
      {
        id: employeeId,
        attendances: [{ id: "att-auto-absent", checkIn: null }], // existing auto-absent row
        leaveRequests: [],
      } as never,
    ]);

    const secondResult = await runAbsenceDetection(MONDAY, "MORNING");
    // Short-circuit: employee already has a row → no createMany call
    expect(prisma.attendance.createMany).not.toHaveBeenCalled();
    expect(secondResult.markedAbsent).toBe(0);
  });

  it("every createMany call uses skipDuplicates:true as the hard duplicate guard", async () => {
    vi.mocked(prisma.employee.findMany).mockResolvedValue([
      { id: "emp-1", attendances: [], leaveRequests: [] } as never,
    ]);
    vi.mocked(prisma.attendance.createMany).mockResolvedValue({ count: 1 });

    await runAbsenceDetection(MONDAY, "MORNING");

    for (const [args] of vi.mocked(prisma.attendance.createMany).mock.calls) {
      expect(args!.skipDuplicates).toBe(true);
    }
  });
});

// ── Non-working day skip ───────────────────────────────────────────────────

describe("non-working day (Sunday 2026-01-18) → skipped", () => {
  it("skips morning detection without querying employees", async () => {
    const result = await runAbsenceDetection(SUNDAY, "MORNING");
    expect(prisma.employee.findMany).not.toHaveBeenCalled();
    expect(prisma.attendance.createMany).not.toHaveBeenCalled();
    expect(result.skippedNonWorkingDay).toBe(true);
    expect(result.markedAbsent).toBe(0);
  });

  it("skips afternoon detection without querying employees", async () => {
    const result = await runAbsenceDetection(SUNDAY, "AFTERNOON");
    expect(prisma.employee.findMany).not.toHaveBeenCalled();
    expect(result.skippedNonWorkingDay).toBe(true);
  });

  it("skips finalization without querying attendances", async () => {
    const result = await runAbsenceFinalization(SUNDAY);
    expect(prisma.attendance.findMany).not.toHaveBeenCalled();
    expect(result.skippedNonWorkingDay).toBe(true);
  });
});

// ── Finalization: leave approved after detection → ON_LEAVE ───────────────

describe("finalization: leave approved after detection → corrects to ON_LEAVE", () => {
  it("updates auto-recorded ABSENT rows to ON_LEAVE when leave is found; session in audit payload", async () => {
    const employeeId   = "emp-late-leave";
    const attendanceId = "att-absent-1";

    vi.mocked(prisma.attendance.findMany).mockResolvedValue([
      { id: attendanceId, employeeId, session: "MORNING" } as never,
    ]);
    vi.mocked(prisma.leaveRequest.findMany).mockResolvedValue([
      { employeeId } as never,
    ]);
    vi.mocked(prisma.attendance.updateMany).mockResolvedValue({ count: 1 });

    const result = await runAbsenceFinalization(MONDAY);

    expect(prisma.attendance.updateMany).toHaveBeenCalledOnce();
    const updateCall = vi.mocked(prisma.attendance.updateMany).mock.calls[0]![0]!;
    expect(updateCall.where).toMatchObject({ id: { in: [attendanceId] } });
    expect(updateCall.data).toMatchObject({ status: "ON_LEAVE" });

    expect(result.correctedToOnLeave).toBe(1);
    expect(result.finalized).toBe(0);
  });
});

// ── correctAbsenceRecord export check ────────────────────────────────────

describe("correctAbsenceRecord is exported from admin-actions", () => {
  it("is a function", async () => {
    const { correctAbsenceRecord } = await import("@/features/attendance/admin-actions");
    expect(typeof correctAbsenceRecord).toBe("function");
  });
});
