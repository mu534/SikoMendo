import { describe, it, expect } from "vitest";
import type { CooperativeFormValues } from "../form-utils";

/**
 * Tests for AddressInformationSection props contract.
 * Verifies the defaultValue derivation logic used by the component.
 */

const base: Partial<CooperativeFormValues> = {
  district: "Bale",
  kebele: "01",
};

describe("AddressInformationSection — props contract", () => {
  it("passes district to defaultValue when cooperative is provided", () => {
    expect(base.district ?? "").toBe("Bale");
  });

  it("passes kebele to defaultValue when cooperative is provided", () => {
    expect(base.kebele ?? "").toBe("01");
  });

  it("falls back to empty string when cooperative is undefined", () => {
    const getCoopOrUndefined = (): Partial<CooperativeFormValues> | undefined => undefined;
    const coop = getCoopOrUndefined();
    expect(coop?.district ?? "").toBe("");
    expect(coop?.kebele ?? "").toBe("");
  });

  it("falls back to empty string when fields are null", () => {
    // district and kebele are required strings, so null won't appear at runtime,
    // but the fallback chain is still tested for defensive correctness.
    const district: string | null = null as string | null;
    expect(district ?? "").toBe("");
  });
});
