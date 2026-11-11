import { describe, it, expect } from "vitest";
import {
  parseTimeToMinutes,
  utcDateToOrgMinutesSinceMidnight,
  orgDateWeekday,
  routeCheckInToSession,
  evaluateSessionCheckIn,
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
  it("converts 13:00 to 780", () => expect(parseTimeToMinutes("13:00")).toBe(780));
  it("converts 13:15 to 795", () => expect(parseTimeToMinutes("13:15")).toBe(795));
  it("converts 17:00 to 1020", () => expect(parseTimeToMinutes("17:00")).toBe(1020));
  it("converts 23:59 to 1439", () => expect(parseTimeToMinutes("23:59")).toBe(1439));
});

// ── utcDateToOrgMinutesSinceMidnight ─────────────────────────────────────

describe("utcDateToOrgMinutesSinceMidnight (EAT = UTC+3)", () => {
  it("converts UTC 05:00 → EAT 08:00 → 480 minutes", () => {
    const d = new Date("2026-01-12T05:00:00.000Z");
    expect(utcDateToOrgMinutesSinceMidnight(d)).toBe(480);
  });

  it("converts UTC 05:16 → EAT 08:16 → 496 minutes", () => {
    const d = new Date("2026-01-12T05:16:00.000Z");
    expect(utcDateToOrgMinutesSinceMidnight(d)).toBe(496);
  });

  it("converts UTC 10:00 → EAT 13:00 → 780 minutes", () => {
    const d = new Date("2026-01-12T10:00:00.000Z");
    expect(utcDateToOrgMinutesSinceMidnight(d)).toBe(780);
  });

  it("converts UTC 10:16 → EAT 13:16 → 796 minutes", () => {
    const d = new Date("2026-01-12T10:16:00.000Z");
    expect(utcDateToOrgMinutesSinceMidnight(d)).toBe(796);
  });
});

// ── orgDateWeekday ────────────────────────────────────────────────────────

describe("orgDateWeekday", () => {
  it("Monday is 1", () => expect(orgDateWeekday("2026-01-12")).toBe(1));
  it("Tuesday is 2", () => expect(orgDateWeekday("2026-01-13")).toBe(2));
  it("Wednesday is 3", () => expect(orgDateWeekday("2026-01-14")).toBe(3));
  it("Saturday is 6", () => expect(orgDateWeekday("2026-01-17")).toBe(6));
  it("Sunday is 7", () => expect(orgDateWeekday("2026-01-18")).toBe(7));
});

// ── routeCheckInToSession ─────────────────────────────────────────────────

describe("routeCheckInToSession", () => {
  const policy = DEFAULT_POLICY; // afternoonStartTime = "13:00"

  function checkInAtEAT(hh: number, mm: number): Date {
    // EAT = UTC+3, so EAT HH:MM → UTC (HH-3):MM
    return new Date(
      `2026-01-12T${String(hh - 3).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00.000Z`
    );
  }

  it("08:10 EAT (before afternoon start) → MORNING", () => {
    expect(routeCheckInToSession(checkInAtEAT(8, 10), policy)).toBe("MORNING");
  });

  it("12:59 EAT (one minute before afternoon start) → MORNING", () => {
    expect(routeCheckInToSession(checkInAtEAT(12, 59), policy)).toBe("MORNING");
  });

  it("13:00 EAT (exactly at afternoon start) → AFTERNOON", () => {
    expect(routeCheckInToSession(checkInAtEAT(13, 0), policy)).toBe("AFTERNOON");
  });

  it("13:10 EAT (after afternoon start) → AFTERNOON", () => {
    expect(routeCheckInToSession(checkInAtEAT(13, 10), policy)).toBe("AFTERNOON");
  });
});

// ── evaluateSessionCheckIn ────────────────────────────────────────────────

describe("evaluateSessionCheckIn — morning session", () => {
  const policy = DEFAULT_POLICY; // morningCheckInDeadline = "08:15", graceMinutes = 15

  function checkInAtEAT(hh: number, mm: number): Date {
    return new Date(
      `2026-01-12T${String(hh - 3).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00.000Z`
    );
  }

  // Scenario 1: check-in before morning deadline → PRESENT (AC-7)
  it("08:00 EAT (before deadline) → PRESENT", () => {
    expect(evaluateSessionCheckIn(checkInAtEAT(8, 0), policy, "MORNING")).toBe("PRESENT");
  });

  it("08:10 EAT (before deadline) → PRESENT", () => {
    expect(evaluateSessionCheckIn(checkInAtEAT(8, 10), policy, "MORNING")).toBe("PRESENT");
  });

  it("08:15 EAT (exactly at deadline) → PRESENT", () => {
    expect(evaluateSessionCheckIn(checkInAtEAT(8, 15), policy, "MORNING")).toBe("PRESENT");
  });

  // Within grace (08:15 deadline + 15 min grace = 08:30) → LATE
  it("08:16 EAT (1 min past deadline, within grace) → LATE", () => {
    expect(evaluateSessionCheckIn(checkInAtEAT(8, 16), policy, "MORNING")).toBe("LATE");
  });

  it("08:29 EAT (last minute of grace) → LATE", () => {
    expect(evaluateSessionCheckIn(checkInAtEAT(8, 29), policy, "MORNING")).toBe("LATE");
  });

  it("08:30 EAT (exactly at end of grace) → LATE", () => {
    expect(evaluateSessionCheckIn(checkInAtEAT(8, 30), policy, "MORNING")).toBe("LATE");
  });

  // Scenario 2: check-in after grace period → ABSENT (AC-8)
  it("08:31 EAT (past deadline + grace) → ABSENT", () => {
    expect(evaluateSessionCheckIn(checkInAtEAT(8, 31), policy, "MORNING")).toBe("ABSENT");
  });

  it("09:30 EAT (well past grace) → ABSENT", () => {
    expect(evaluateSessionCheckIn(checkInAtEAT(9, 30), policy, "MORNING")).toBe("ABSENT");
  });

  // Zero grace: any check-in after deadline → ABSENT immediately
  it("zero grace: 08:16 EAT → ABSENT", () => {
    const noGrace = { ...policy, graceMinutes: 0 };
    expect(evaluateSessionCheckIn(checkInAtEAT(8, 16), noGrace, "MORNING")).toBe("ABSENT");
  });
});

describe("evaluateSessionCheckIn — afternoon session", () => {
  const policy = DEFAULT_POLICY; // afternoonCheckInDeadline = "13:15", graceMinutes = 15

  function checkInAtEAT(hh: number, mm: number): Date {
    return new Date(
      `2026-01-12T${String(hh - 3).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00.000Z`
    );
  }

  // Scenario 4: check-in before afternoon deadline → PRESENT (AC-10)
  it("13:00 EAT (before deadline) → PRESENT", () => {
    expect(evaluateSessionCheckIn(checkInAtEAT(13, 0), policy, "AFTERNOON")).toBe("PRESENT");
  });

  it("13:10 EAT (before deadline) → PRESENT", () => {
    expect(evaluateSessionCheckIn(checkInAtEAT(13, 10), policy, "AFTERNOON")).toBe("PRESENT");
  });

  it("13:15 EAT (exactly at deadline) → PRESENT", () => {
    expect(evaluateSessionCheckIn(checkInAtEAT(13, 15), policy, "AFTERNOON")).toBe("PRESENT");
  });

  // Within grace (13:15 deadline + 15 min grace = 13:30) → LATE
  it("13:16 EAT (1 min past deadline, within grace) → LATE", () => {
    expect(evaluateSessionCheckIn(checkInAtEAT(13, 16), policy, "AFTERNOON")).toBe("LATE");
  });

  it("13:30 EAT (exactly at end of grace) → LATE", () => {
    expect(evaluateSessionCheckIn(checkInAtEAT(13, 30), policy, "AFTERNOON")).toBe("LATE");
  });

  // Scenario 5: check-in after grace → ABSENT (AC-11)
  it("13:31 EAT (past deadline + grace) → ABSENT", () => {
    expect(evaluateSessionCheckIn(checkInAtEAT(13, 31), policy, "AFTERNOON")).toBe("ABSENT");
  });

  it("14:30 EAT (well past grace) → ABSENT", () => {
    expect(evaluateSessionCheckIn(checkInAtEAT(14, 30), policy, "AFTERNOON")).toBe("ABSENT");
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
    morningStartTime:         "08:00",
    morningCheckInDeadline:   "08:15",
    afternoonStartTime:       "13:00",
    afternoonCheckInDeadline: "13:15",
    graceMinutes:             15,
    workingDays:              "[1,2,3,4,5]",
    isActive:                 true,
  };

  it("parses a valid row into PolicyValues", () => {
    const result = normalisePolicyRow(base);
    expect(result.morningStartTime).toBe("08:00");
    expect(result.morningCheckInDeadline).toBe("08:15");
    expect(result.afternoonStartTime).toBe("13:00");
    expect(result.afternoonCheckInDeadline).toBe("13:15");
    expect(result.graceMinutes).toBe(15);
    expect(result.workingDays).toEqual([1, 2, 3, 4, 5]);
    expect(result.isActive).toBe(true);
  });

  it("falls back to Mon–Fri when workingDays JSON is corrupt", () => {
    const result = normalisePolicyRow({ ...base, workingDays: "not-json" });
    expect(result.workingDays).toEqual([1, 2, 3, 4, 5]);
  });

  it("preserves morningCheckInDeadline and afternoonCheckInDeadline when custom", () => {
    const result = normalisePolicyRow({
      ...base,
      morningCheckInDeadline:   "09:00",
      afternoonCheckInDeadline: "14:00",
    });
    expect(result.morningCheckInDeadline).toBe("09:00");
    expect(result.afternoonCheckInDeadline).toBe("14:00");
  });

  it("clamps negative graceMinutes to 0", () => {
    const result = normalisePolicyRow({ ...base, graceMinutes: -5 });
    expect(result.graceMinutes).toBe(0);
  });

  it("preserves custom graceMinutes", () => {
    const result = normalisePolicyRow({ ...base, graceMinutes: 30 });
    expect(result.graceMinutes).toBe(30);
  });
});
