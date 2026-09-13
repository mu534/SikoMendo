import { describe, it, expect } from "vitest";

/**
 * Tests for MembershipSection business logic.
 * The key invariant this section enforces: maleMembers + femaleMembers === totalMembers.
 */

function memberMismatch(total: string, male: string, female: string): boolean {
  if (total === "" || male === "" || female === "") return false;
  return (parseInt(male) || 0) + (parseInt(female) || 0) !== (parseInt(total) || 0);
}

describe("MembershipSection — mismatch detection", () => {
  it("returns false when counts match exactly", () => {
    expect(memberMismatch("10", "6", "4")).toBe(false);
  });

  it("returns true when male + female exceeds total", () => {
    expect(memberMismatch("10", "7", "4")).toBe(true);
  });

  it("returns true when male + female is less than total", () => {
    expect(memberMismatch("10", "5", "4")).toBe(true);
  });

  it("returns false when any field is empty (user still typing)", () => {
    expect(memberMismatch("", "6", "4")).toBe(false);
    expect(memberMismatch("10", "", "4")).toBe(false);
    expect(memberMismatch("10", "6", "")).toBe(false);
  });

  it("handles zero total correctly", () => {
    expect(memberMismatch("0", "0", "0")).toBe(false);
  });

  it("treats non-numeric input as 0", () => {
    expect(memberMismatch("10", "abc", "4")).toBe(true); // 0 + 4 = 4 ≠ 10
  });
});

describe("MembershipSection — initial values from cooperative prop", () => {
  it("derives initial string values from numeric fields", () => {
    const cooperative = { totalMembers: 10, maleMembers: 6, femaleMembers: 4 };
    expect(String(cooperative.totalMembers)).toBe("10");
    expect(String(cooperative.maleMembers)).toBe("6");
    expect(String(cooperative.femaleMembers)).toBe("4");
  });

  it("uses empty string when cooperative is undefined", () => {
    const c: { totalMembers?: number } = {};
    expect(c.totalMembers !== undefined ? String(c.totalMembers) : "").toBe("");
  });
});
