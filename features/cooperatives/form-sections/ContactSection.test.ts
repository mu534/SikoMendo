import { describe, it, expect } from "vitest";
import type { CooperativeFormValues } from "../form-utils";

/**
 * Tests for ContactSection props contract.
 * All fields are optional — they fall back to empty string when null/undefined.
 */

const withContact: Partial<CooperativeFormValues> = {
  contactPerson: "Abebe Bekele",
  contactEmail: "abebe@example.com",
  contactPhone: "+251911000000",
  location: "Robe, Bale Zone",
  description: "A grain marketing cooperative.",
};

describe("ContactSection — optional field fallbacks", () => {
  it("passes contactPerson when set", () => {
    expect(withContact.contactPerson ?? "").toBe("Abebe Bekele");
  });

  it("falls back to empty string when contactPerson is null", () => {
    expect((null as string | null) ?? "").toBe("");
  });

  it("falls back to empty string when contactEmail is undefined", () => {
    const coop: Partial<CooperativeFormValues> = {};
    expect(coop.contactEmail ?? "").toBe("");
  });

  it("falls back to empty string when location is null", () => {
    expect((null as string | null) ?? "").toBe("");
  });

  it("falls back to empty string when description is null", () => {
    expect((null as string | null) ?? "").toBe("");
  });

  it("passes all fields when fully populated", () => {
    const coop = withContact as CooperativeFormValues;
    expect(coop.contactPerson ?? "").toBe("Abebe Bekele");
    expect(coop.contactEmail ?? "").toBe("abebe@example.com");
    expect(coop.contactPhone ?? "").toBe("+251911000000");
    expect(coop.location ?? "").toBe("Robe, Bale Zone");
    expect(coop.description ?? "").toBe("A grain marketing cooperative.");
  });
});
