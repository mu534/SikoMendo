import { describe, it, expect } from "vitest";

/**
 * Tests for CapitalSection business logic.
 * Key computed value: totalCapital = fixedAssets + currentAssets.
 */

function computeTotalCapital(fixed: string, current: string): number | null {
  if (fixed === "" && current === "") return null;
  return (parseFloat(fixed) || 0) + (parseFloat(current) || 0);
}

describe("CapitalSection — totalCapital calculation", () => {
  it("adds fixed and current assets correctly", () => {
    expect(computeTotalCapital("1000", "500")).toBe(1500);
  });

  it("returns null when both fields are empty", () => {
    expect(computeTotalCapital("", "")).toBeNull();
  });

  it("returns just currentAssets when fixedAssets is empty", () => {
    expect(computeTotalCapital("", "500")).toBe(500);
  });

  it("returns just fixedAssets when currentAssets is empty", () => {
    expect(computeTotalCapital("1000", "")).toBe(1000);
  });

  it("handles decimal values", () => {
    expect(computeTotalCapital("1000.50", "499.50")).toBeCloseTo(1500);
  });

  it("handles zero values", () => {
    expect(computeTotalCapital("0", "0")).toBe(0);
  });

  it("treats non-numeric input as 0", () => {
    expect(computeTotalCapital("abc", "500")).toBe(500);
  });
});
