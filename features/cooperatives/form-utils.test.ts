import { describe, it, expect } from "vitest";
import { toDateInputValue } from "./form-utils";

describe("toDateInputValue", () => {
  it("converts an ISO date string to YYYY-MM-DD", () => {
    expect(toDateInputValue("2020-01-15T00:00:00.000Z")).toBe("2020-01-15");
  });

  it("returns empty string for null", () => {
    expect(toDateInputValue(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(toDateInputValue(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(toDateInputValue("")).toBe("");
  });

  it("handles a date-only string without time component", () => {
    expect(toDateInputValue("2023-06-30")).toBe("2023-06-30");
  });
});
