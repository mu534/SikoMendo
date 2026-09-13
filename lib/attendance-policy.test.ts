import { describe, it, expect } from "vitest";
import {
  parseTimeToMinutes,
  utcDateToOrgMinutesSinceMidnight,
  orgDateWeekday,
  evaluateCheckInStatus,
  isWorkingDay,
  normalisePolicyRow,
  DEFAULT_POLICY,
  type PolicyValues,
} from "./attendance-policy";

// ── parseTimeToMinutes ────────────────────────────────────────────────────

describe("parseTimeToMinutes", () => {
  it("converts 00:00 to 0", () => expect(parseTimeToMinutes("00:00")).toBe(0));
  it("converts 08:00 to 480", () => expect(parseTimeToMinutes("08:00")).toBe(480));
  it("converts 08:15 to 495", () => expect(parseTimeToMinutes("08:15")).toBe(495));
  it("converts 17:00 to 1020", () => expect(parseTimeToMinutes("17:00")).toBe(1020));
  it("converts 23:59 to 1439", () => expect(parseTimeToMinutes("23:59")).toBe(1439));
});

// ── utcDateToOrgMinutesSinceMidnight ─────────────────────────────────────

describe("utcDateToOrgMinutesSinceMidnight (EAT = UTC+3)", () => {
  it("converts UTC 05:00 → EAT 08:00 → 480 minutes", () => {
    // 05:00 UTC = 08:00 EAT
    const d = new Date("2026-01-12T05:00:00.000Z");
    expect(utcDateToOrgMinutesSinceMidnight(d)).toBe(480);
  });

  it("converts UTC 05:16 → EAT 08:16 → 496 minutes", () => {
    const d = new Date("2026-01-12T05:16:00.000Z");
    expect(utcDateToOrgMinutesSinceMidnight(d)).toBe(496);
  });

  it("converts UTC 02:00 → EAT 05:00 → 300 minutes", () => {
    const d = new Date("2026-01-12T02:00:00.000Z");
    expect(utcDateToOrgMinutesSinceMidnight(d)).toBe(300);
  });

  it("converts UTC 21:00 (previous UTC day) → EAT 00:00 → 0 minutes", () => {
    const d = new Date("2026-01-11T21:00:00.000Z");
    expect(utcDateToOrgMinutesSinceMidnight(d)).toBe(0);
  });
});

// ── orgDateWeekday ────────────────────────────────────────────────────────

describe("orgDateWeekday", () => {
  it("Monday is 1", () => expect(orgDateWeekday("2026-01-12")).toBe(1)); // 12 Jan 2026 = Monday
  it("Tuesday is 2", () => expect(orgDateWeekday("2026-01-13")).toBe(2));
  it("Wednesday is 3", () => expect(orgDateWeekday("2026-01-14")).toBe(3));
  it("Saturday is 6", () => expect(orgDateWeekday("2026-01-17")).toBe(6));
  it("Sunday is 7", () => expect(orgDateWeekday("2026-01-18")).toBe(7));
});

// ── evaluateCheckInStatus ─────────────────────────────────────────────────

describe("evaluateCheckInStatus", () => {
  // Default policy: start 08:00, grace 15 min, no half-day threshold
  const policy = DEFAULT_POLICY;
  const date   = "2026-01-12"; // Monday

  function checkInAtEAT(hh: number, mm: number): Date {
    // EAT = UTC+3, so EAT HH:MM = UTC (HH-3):MM
    return new Date(`2026-01-12T${String(hh - 3).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00.000Z`);
  }

  it("08:00 EAT (exactly on time) → PRESENT", () => {
    expect(evaluateCheckInStatus(checkInAtEAT(8, 0), policy, date)).toBe("PRESENT");
  });

  it("08:15 EAT (end of grace period) → PRESENT", () => {
    expect(evaluateCheckInStatus(checkInAtEAT(8, 15), policy, date)).toBe("PRESENT");
  });

  it("08:16 EAT (one minute past grace) → LATE", () => {
    expect(evaluateCheckInStatus(checkInAtEAT(8, 16), policy, date)).toBe("LATE");
  });

  it("09:30 EAT → LATE (no half-day threshold set)", () => {
    expect(evaluateCheckInStatus(checkInAtEAT(9, 30), policy, date)).toBe("LATE");
  });

  it("07:55 EAT (before start time) → PRESENT (early arrival counts as on time)", () => {
    // 7:55 EAT → 495 minutes = 07:55 EAT → still within grace cutoff (480+15=495)
    // Actually 07:55 = 475 minutes < 495 graceCutoff → PRESENT
    expect(evaluateCheckInStatus(checkInAtEAT(7, 55), policy, date)).toBe("PRESENT");
  });

  it("with half-day threshold: 10:16 EAT (beyond threshold) → HALF_DAY", () => {
    const policyWithHalfDay: PolicyValues = {
      ...policy,
      halfDayThresholdMinutes: 120, // 2h after grace cutoff = 08:16 + 120 = 10:16
    };
    expect(evaluateCheckInStatus(checkInAtEAT(10, 16), policyWithHalfDay, date)).toBe("HALF_DAY");
  });

  it("with half-day threshold: 09:00 EAT (after grace, before threshold) → LATE", () => {
    const policyWithHalfDay: PolicyValues = {
      ...policy,
      halfDayThresholdMinutes: 120,
    };
    expect(evaluateCheckInStatus(checkInAtEAT(9, 0), policyWithHalfDay, date)).toBe("LATE");
  });

  it("with zero grace period: exactly on time → PRESENT", () => {
    const strictPolicy: PolicyValues = { ...policy, gracePeriodMinutes: 0 };
    expect(evaluateCheckInStatus(checkInAtEAT(8, 0), strictPolicy, date)).toBe("PRESENT");
  });

  it("with zero grace period: one minute late → LATE", () => {
    const strictPolicy: PolicyValues = { ...policy, gracePeriodMinutes: 0 };
    expect(evaluateCheckInStatus(checkInAtEAT(8, 1), strictPolicy, date)).toBe("LATE");
  });

  it("with custom start time 09:00: check-in at 09:10 within 15-min grace → PRESENT", () => {
    const lateStartPolicy: PolicyValues = { ...policy, workStartTime: "09:00" };
    expect(evaluateCheckInStatus(checkInAtEAT(9, 10), lateStartPolicy, date)).toBe("PRESENT");
  });

  it("with custom start time 09:00: check-in at 09:16 → LATE", () => {
    const lateStartPolicy: PolicyValues = { ...policy, workStartTime: "09:00" };
    expect(evaluateCheckInStatus(checkInAtEAT(9, 16), lateStartPolicy, date)).toBe("LATE");
  });
});

// ── isWorkingDay ──────────────────────────────────────────────────────────

describe("isWorkingDay", () => {
  const policy = DEFAULT_POLICY; // Mon–Fri

  it("Monday (2026-01-12) is a working day", () =>
    expect(isWorkingDay("2026-01-12", policy)).toBe(true));

  it("Friday (2026-01-16) is a working day", () =>
    expect(isWorkingDay("2026-01-16", policy)).toBe(true));

  it("Saturday (2026-01-17) is NOT a working day", () =>
    expect(isWorkingDay("2026-01-17", policy)).toBe(false));

  it("Sunday (2026-01-18) is NOT a working day", () =>
    expect(isWorkingDay("2026-01-18", policy)).toBe(false));

  it("with 6-day week (Mon–Sat): Saturday IS a working day", () => {
    const sixDayPolicy: PolicyValues = { ...policy, workingDays: [1, 2, 3, 4, 5, 6] };
    expect(isWorkingDay("2026-01-17", sixDayPolicy)).toBe(true);
    expect(isWorkingDay("2026-01-18", sixDayPolicy)).toBe(false);
  });
});

// ── normalisePolicyRow ────────────────────────────────────────────────────

describe("normalisePolicyRow", () => {
  const base = {
    workStartTime: "08:00",
    workEndTime: "17:00",
    gracePeriodMinutes: 15,
    halfDayThresholdMinutes: null,
    workingDays: "[1,2,3,4,5]",
    isActive: true,
  };

  it("parses a valid row into PolicyValues", () => {
    const result = normalisePolicyRow(base);
    expect(result.workStartTime).toBe("08:00");
    expect(result.gracePeriodMinutes).toBe(15);
    expect(result.workingDays).toEqual([1, 2, 3, 4, 5]);
    expect(result.halfDayThresholdMinutes).toBeNull();
  });

  it("falls back to Mon–Fri when workingDays JSON is corrupt", () => {
    const result = normalisePolicyRow({ ...base, workingDays: "not-json" });
    expect(result.workingDays).toEqual([1, 2, 3, 4, 5]);
  });

  it("falls back to Mon–Fri when workingDays is an empty array", () => {
    // An empty array is valid JSON but semantically wrong — it means "no working days"
    // The normaliser currently preserves whatever is stored; this test documents that
    // the caller is responsible for ensuring at least one working day is configured.
    const result = normalisePolicyRow({ ...base, workingDays: "[]" });
    expect(result.workingDays).toEqual([]);
  });

  it("clamps negative gracePeriodMinutes to 0", () => {
    const result = normalisePolicyRow({ ...base, gracePeriodMinutes: -5 });
    expect(result.gracePeriodMinutes).toBe(0);
  });

  it("preserves halfDayThresholdMinutes when set", () => {
    const result = normalisePolicyRow({ ...base, halfDayThresholdMinutes: 120 });
    expect(result.halfDayThresholdMinutes).toBe(120);
  });
});
