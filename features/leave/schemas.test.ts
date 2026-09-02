import { describe, it, expect } from "vitest";
import {
  calculateTotalDays,
  leaveRequestSchema,
  leaveDecisionSchema,
} from "./schemas";

describe("calculateTotalDays", () => {
  it("counts a single day as 1", () => {
    expect(calculateTotalDays("2026-01-05", "2026-01-05")).toBe(1);
  });

  it("counts a Mon\u2013Fri work week as 5 (inclusive of both ends)", () => {
    expect(calculateTotalDays("2026-01-05", "2026-01-09")).toBe(5);
  });

  it("counts across a month boundary correctly", () => {
    expect(calculateTotalDays("2026-01-30", "2026-02-02")).toBe(4);
  });

  it("does NOT exclude weekends \u2014 this is calendar days, not working days", () => {
    // 2026-01-05 is a Monday, 2026-01-11 is the following Sunday: 7 calendar
    // days including two weekend days. If your organization's leave policy
    // expects weekends to be excluded from the day count, this function
    // needs to change — this test documents the current (calendar-day)
    // behavior so a future change here is a deliberate choice, not a
    // silent regression.
    expect(calculateTotalDays("2026-01-05", "2026-01-11")).toBe(7);
  });
});

describe("leaveRequestSchema", () => {
  const base = {
    leaveType: "ANNUAL" as const,
    startDate: "2026-03-01",
    endDate: "2026-03-05",
    reason: "Family event",
  };

  it("accepts a valid request", () => {
    const result = leaveRequestSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("rejects an end date before the start date", () => {
    const result = leaveRequestSchema.safeParse({ ...base, startDate: "2026-03-05", endDate: "2026-03-01" });
    expect(result.success).toBe(false);
  });

  it("rejects a reason shorter than 5 characters", () => {
    const result = leaveRequestSchema.safeParse({ ...base, reason: "sick" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid leave type", () => {
    const result = leaveRequestSchema.safeParse({ ...base, leaveType: "VACATION" });
    expect(result.success).toBe(false);
  });
});

describe("leaveDecisionSchema", () => {
  it("accepts an approval with no rejection reason", () => {
    const result = leaveDecisionSchema.safeParse({ decision: "APPROVED", rejectionReason: "" });
    expect(result.success).toBe(true);
  });

  it("rejects a REJECTED decision with no reason", () => {
    const result = leaveDecisionSchema.safeParse({ decision: "REJECTED", rejectionReason: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a REJECTED decision with too short a reason", () => {
    const result = leaveDecisionSchema.safeParse({ decision: "REJECTED", rejectionReason: "no" });
    expect(result.success).toBe(false);
  });

  it("accepts a REJECTED decision with a valid reason", () => {
    const result = leaveDecisionSchema.safeParse({ decision: "REJECTED", rejectionReason: "Coverage conflict" });
    expect(result.success).toBe(true);
  });
});
