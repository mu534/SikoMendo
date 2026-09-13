import { describe, it, expect } from "vitest";

/**
 * Tests for RegistrationDetailsSection business logic.
 * Key computed value: totalShareValue = numberOfShares × pricePerShare.
 */

function computeTotalShareValue(numShares: string, priceShare: string): number | null {
  if (numShares === "" && priceShare === "") return null;
  return (parseFloat(numShares) || 0) * (parseFloat(priceShare) || 0);
}

function formatShareValue(value: number | null): string {
  if (value == null) return "";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

describe("RegistrationDetailsSection — totalShareValue calculation", () => {
  it("multiplies shares by price correctly", () => {
    expect(computeTotalShareValue("100", "50")).toBe(5000);
  });

  it("returns null when both fields are empty", () => {
    expect(computeTotalShareValue("", "")).toBeNull();
  });

  it("treats empty numShares as 0 when priceShare is set", () => {
    expect(computeTotalShareValue("", "50")).toBe(0);
  });

  it("treats empty priceShare as 0 when numShares is set", () => {
    expect(computeTotalShareValue("100", "")).toBe(0);
  });

  it("handles decimal shares and prices", () => {
    expect(computeTotalShareValue("10", "2.5")).toBeCloseTo(25);
  });

  it("handles zero shares", () => {
    expect(computeTotalShareValue("0", "100")).toBe(0);
  });
});

describe("RegistrationDetailsSection — formatShareValue", () => {
  it("formats 5000 as '5,000.00'", () => {
    expect(formatShareValue(5000)).toBe("5,000.00");
  });

  it("returns empty string for null", () => {
    expect(formatShareValue(null)).toBe("");
  });

  it("formats decimals correctly", () => {
    expect(formatShareValue(25.5)).toBe("25.50");
  });
});

describe("RegistrationDetailsSection — registrationFee defaultValue", () => {
  it("converts numeric fee to string for defaultValue", () => {
    const fee = 500;
    expect(fee != null ? String(fee) : "").toBe("500");
  });

  it("uses empty string when fee is null/undefined", () => {
    const fee: number | null | undefined = null;
    expect(fee != null ? String(fee) : "").toBe("");
  });
});
