/**
 * Unit tests for lib/attendance-jobs.ts
 *
 * All Prisma calls and external dependencies are mocked — no DB required.
 * The 9 test cases verify the full absence-detection and finalization logic.
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

// Mock the auth/session chain needed when admin-actions is imported in TC9.
vi.mock("@/lib/session", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth",    () => ({ auth: {} }));

// ── Imports ───────────────────────────────────────────────────────────────

import prisma from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { runAbsenceDetection, runAbsenceFinalization } from "@/lib/attendance-jobs";

// ── Helpers ───────────────────────────────────────────────────────────────

const MONDAY = "2026-01-12"; // ISO weekday 1 (Mon) — working day per default policy
const SUNDAY = "2026-01-18"; // ISO weekday 7 (Sun) — non-working per default policy

/** Default policy row returned by attendancePolicy.findUnique mock. */
const DEFAULT_POLICY_ROW = {
  id: "singleton",
  workStartTime: "08:00",
  workEndTime: "17:00",
  gracePeriodMinutes: 15,
  halfDayThresholdMinutes: null,
  workingDays: "[1,2,3,4,5]",
  absenceDetectionTime: "10:00",
  isActive: true,
  updatedAt: new Date(),
  updatedById: null,
};

/** A mock UTC check-in time at 08:05 EAT (05:05 UTC) — within grace period → PRESENT. */
const CHECK_IN_08_05_EAT = new Date("2026-01-12T05:05:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  // Default: policy row always resolves to the default policy.
  vi.mocked(prisma.attendancePolicy.findUnique).mockResolvedValue(DEFAULT_POLICY_ROW as never);
  // Default: no HR/admin users (saves notification setup in each test).
  vi.mocked(prisma.user.findMany).mockResolvedValue([]);
  // Default: createMany / updateMany / auditLog.createMany resolve to count 0.
  vi.mocked(prisma.attendance.createMany).mockResolvedValue({ count: 0 });
  vi.mocked(prisma.attendance.updateMany).mockResolvedValue({ count: 0 });
  vi.mocked(prisma.auditLog.createMany).mockResolvedValue({ count: 0 });
  vi.mocked(prisma.leaveRequest.findMany).mockResolvedValue([]);
});

// ── TC1: employee has no check-in at detection time → ABSENT created ──────

describe("TC1: employee with no check-in → ABSENT created", () => {
  it("calls createMany with ABSENT + autoRecorded=true and returns markedAbsent=1", async () => {
    const employeeId = "emp-1";

    vi.mocked(prisma.employee.findMany).mockResolvedValue([
      {
        id: employeeId,
        attendances: [],
        leaveRequests: [],
      } as never,
    ]);
    vi.mocked(prisma.attendance.createMany).mockResolvedValue({ count: 1 });

    const result = await runAbsenceDetection(MONDAY);

    expect(prisma.attendance.createMany).toHaveBeenCalledOnce();
    const call = vi.mocked(prisma.attendance.createMany).mock.calls[0]![0]!;
    expect(call.skipDuplicates).toBe(true);
    const dataArr = Array.isArray(call.data) ? call.data : [call.data];
    expect(dataArr).toHaveLength(1);
    expect(dataArr[0]).toMatchObject({
      employeeId,
      status: "ABSENT",
      autoRecorded: true,
    });

    expect(result.markedAbsent).toBe(1);
    expect(result.skippedNonWorkingDay).toBe(false);
  });
});

// ── TC2: employee checks in before finalization → row excluded ────────────

describe("TC2: employee checks in after detection → finalization skips them", () => {
  it("returns finalized=0 when no autoRecorded ABSENT rows have checkIn=null", async () => {
    // Simulate: no pending rows (employee checked in, so checkIn is not null →
    // the WHERE filter in findMany would return nothing).
    vi.mocked(prisma.attendance.findMany).mockResolvedValue([]);

    const result = await runAbsenceFinalization(MONDAY);

    expect(prisma.attendance.updateMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.createMany).not.toHaveBeenCalled();
    expect(result.finalized).toBe(0);
    expect(result.skippedNonWorkingDay).toBe(false);
  });
});

// ── TC3: employee has approved leave → excluded from detection ────────────

describe("TC3: employee with approved leave → excluded from absence detection", () => {
  it("does not include leave-covered employees in createMany payload", async () => {
    vi.mocked(prisma.employee.findMany).mockResolvedValue([
      {
        id: "emp-on-leave",
        attendances: [],
        leaveRequests: [{ id: "lr-1" }], // approved leave present
      } as never,
    ]);
    vi.mocked(prisma.attendance.createMany).mockResolvedValue({ count: 0 });

    const result = await runAbsenceDetection(MONDAY);

    // createMany should not be called because no employees qualify
    expect(prisma.attendance.createMany).not.toHaveBeenCalled();
    expect(result.markedAbsent).toBe(0);
  });
});

// ── TC4: non-working day → detection returns early ────────────────────────

describe("TC4: non-working day (Sunday 2026-01-18) → skipped", () => {
  it("skips detection without querying employees", async () => {
    const result = await runAbsenceDetection(SUNDAY);

    expect(prisma.employee.findMany).not.toHaveBeenCalled();
    expect(prisma.attendance.createMany).not.toHaveBeenCalled();
    expect(result.skippedNonWorkingDay).toBe(true);
    expect(result.markedAbsent).toBe(0);
  });

  it("skips finalization without querying attendances", async () => {
    const result = await runAbsenceFinalization(SUNDAY);

    expect(prisma.attendance.findMany).not.toHaveBeenCalled();
    expect(result.skippedNonWorkingDay).toBe(true);
    expect(result.finalized).toBe(0);
  });
});

// ── TC5: inactive employee → not in results ───────────────────────────────

describe("TC5: inactive employee → not marked absent", () => {
  it("returns markedAbsent=0 when employee.findMany returns empty (inactive filtered by DB query)", async () => {
    // The WHERE clause in detection includes `employmentStatus: 'ACTIVE'`, so
    // inactive employees are never returned. Mock simulates that.
    vi.mocked(prisma.employee.findMany).mockResolvedValue([]);
    vi.mocked(prisma.attendance.createMany).mockResolvedValue({ count: 0 });

    const result = await runAbsenceDetection(MONDAY);

    expect(prisma.attendance.createMany).not.toHaveBeenCalled();
    expect(result.markedAbsent).toBe(0);
  });
});

// ── TC6: employee already has attendance with checkIn → excluded ──────────

describe("TC6: existing attendance record with checkIn → excluded from createMany", () => {
  it("does not create duplicate absence when employee already has a valid check-in", async () => {
    vi.mocked(prisma.employee.findMany).mockResolvedValue([
      {
        id: "emp-present",
        attendances: [
          {
            id: "att-1",
            checkIn: CHECK_IN_08_05_EAT, // has a check-in → excluded
          },
        ],
        leaveRequests: [],
      } as never,
    ]);
    vi.mocked(prisma.attendance.createMany).mockResolvedValue({ count: 0 });

    const result = await runAbsenceDetection(MONDAY);

    expect(prisma.attendance.createMany).not.toHaveBeenCalled();
    expect(result.markedAbsent).toBe(0);
  });
});

// ── TC7: second run is idempotent ─────────────────────────────────────────

describe("TC7: job runs twice — idempotent (skipDuplicates)", () => {
  it("uses skipDuplicates:true so second run produces no extra records", async () => {
    const employeeId = "emp-1";

    // First run: employee has no attendance yet.
    vi.mocked(prisma.employee.findMany).mockResolvedValue([
      { id: employeeId, attendances: [], leaveRequests: [] } as never,
    ]);
    vi.mocked(prisma.attendance.createMany).mockResolvedValue({ count: 1 });

    await runAbsenceDetection(MONDAY);

    // Second run: employee still has no attendance (DB would reject duplicate,
    // but skipDuplicates means Prisma returns count=0 without error).
    vi.mocked(prisma.attendance.createMany).mockResolvedValue({ count: 0 });

    const secondResult = await runAbsenceDetection(MONDAY);

    // The call still includes skipDuplicates: true.
    const calls = vi.mocked(prisma.attendance.createMany).mock.calls;
    for (const [args] of calls) {
      expect(args!.skipDuplicates).toBe(true);
    }
    // No error on second run.
    expect(secondResult.markedAbsent).toBe(0);
  });
});

// ── TC8: correction status calculation (evaluateCheckInStatus) ────────────

describe("TC8: evaluateCheckInStatus with 08:05 EAT check-in → PRESENT", () => {
  it("correctly classifies an 08:05 EAT check-in as PRESENT under default policy", async () => {
    // This test exercises the policy engine directly, confirming the library
    // that attendance-jobs relies on when callers use it for corrections.
    const { evaluateCheckInStatus, DEFAULT_POLICY } = await import("@/lib/attendance-policy");

    const status = evaluateCheckInStatus(CHECK_IN_08_05_EAT, DEFAULT_POLICY, MONDAY);
    expect(status).toBe("PRESENT");
  });
});

// ── TC9: leave approved after Stage 1 → finalization updates to ON_LEAVE ──

describe("TC9: leave approved after detection → finalization corrects to ON_LEAVE", () => {
  it("updates auto-recorded ABSENT rows to ON_LEAVE when leave is found", async () => {
    const employeeId = "emp-late-leave";
    const attendanceId = "att-absent-1";

    // Stage 2 finds one pending auto-recorded ABSENT row.
    vi.mocked(prisma.attendance.findMany).mockResolvedValue([
      { id: attendanceId, employeeId } as never,
    ]);

    // That employee now has approved leave.
    vi.mocked(prisma.leaveRequest.findMany).mockResolvedValue([
      { employeeId } as never,
    ]);

    vi.mocked(prisma.attendance.updateMany).mockResolvedValue({ count: 1 });

    const result = await runAbsenceFinalization(MONDAY);

    expect(prisma.attendance.updateMany).toHaveBeenCalledOnce();
    const updateCall = vi.mocked(prisma.attendance.updateMany).mock.calls[0]![0]!;
    expect(updateCall.where).toMatchObject({ id: { in: [attendanceId] } });
    expect(updateCall.data).toMatchObject({ status: "ON_LEAVE" });

    // No audit log for the ON_LEAVE corrected row — only for confirmed absents.
    expect(prisma.auditLog.createMany).not.toHaveBeenCalled();

    expect(result.correctedToOnLeave).toBe(1);
    expect(result.finalized).toBe(0);
  });
});

// ── TC9 (FEAT-004): correctAbsenceRecord export is a function ─────────────

describe("TC9: correctAbsenceRecord is exported from admin-actions", () => {
  it("is a function (structural check — DB logic tested via integration)", async () => {
    // @/lib/session and @/lib/auth are mocked at the top of this file,
    // so the module loads without env validation.
    const { correctAbsenceRecord } = await import("@/features/attendance/admin-actions");
    expect(typeof correctAbsenceRecord).toBe("function");
  });
});
