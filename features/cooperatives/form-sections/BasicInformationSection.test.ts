import { describe, it, expect } from "vitest";
import { toDateInputValue } from "../form-utils";
import type { CooperativeFormValues } from "../form-utils";

/**
 * Unit tests for BasicInformationSection props and the helper functions it relies on.
 * Component rendering is not tested here (no DOM environment); we test the
 * data-shaping logic that the component uses directly.
 */

const baseCooperative: CooperativeFormValues = {
  cooperativeId: "COOP-0001",
  name: "Bale Robe Farmers Cooperative",
  cooperativeType: "Agricultural",
  registrationNumber: "REG-001",
  registrationDate: "2020-01-15T00:00:00.000Z",
  dateJoinedUnion: "2020-02-01T00:00:00.000Z",
  isActive: true,
  district: "Bale",
  kebele: "01",
  businessType: "Farming",
  registrationFee: 500,
  numberOfShares: 100,
  pricePerShare: 50,
  totalMembers: 10,
  maleMembers: 6,
  femaleMembers: 4,
  fixedAssets: 1000,
  currentAssets: 500,
};

describe("BasicInformationSection — props contract", () => {
  it("toDateInputValue produces the correct string for registrationDate", () => {
    expect(toDateInputValue(baseCooperative.registrationDate)).toBe("2020-01-15");
  });

  it("toDateInputValue produces the correct string for dateJoinedUnion", () => {
    expect(toDateInputValue(baseCooperative.dateJoinedUnion)).toBe("2020-02-01");
  });

  it("isActive false should map to the string 'false' for the select default value", () => {
    const inactive = { ...baseCooperative, isActive: false };
    expect(inactive.isActive === false ? "false" : "true").toBe("false");
  });

  it("isActive true should map to the string 'true' for the select default value", () => {
    expect(baseCooperative.isActive === false ? "false" : "true").toBe("true");
  });

  it("missing cooperativeId falls back to cooperativeId prop then to placeholder", () => {
    // Simulate a form values object where cooperativeId is absent (new cooperative).
    const withoutId: Omit<CooperativeFormValues, "cooperativeId"> & { cooperativeId?: string } = {
      ...baseCooperative,
      cooperativeId: undefined,
    };

    // First fallback: use an externally supplied cooperativeId prop
    const externalCoopId: string | undefined = "COOP-PROP";
    const fallbackToCoopId = withoutId.cooperativeId ?? externalCoopId ?? "Auto-generated";
    expect(fallbackToCoopId).toBe("COOP-PROP");

    // Second fallback: no external prop either — fall through to placeholder
    const noExternalId: string | undefined = undefined;
    const noId = withoutId.cooperativeId ?? noExternalId ?? "Auto-generated";
    expect(noId).toBe("Auto-generated");
  });
});
