import { describe, it, expect } from "vitest";
import { cooperativeSchema } from "./schemas";

// All fields are strings here because the schema parses raw form-data input
// (numbers/dates arrive as strings and get transformed inside the schema).
const validBase = {
  name: "Bale Robe Farmers Cooperative",
  cooperativeType: "Agricultural",
  registrationNumber: "REG-001",
  registrationDate: "2020-01-15",
  dateJoinedUnion: "2020-02-01",
  isActive: "true",
  district: "Bale",
  kebele: "01",
  businessType: "Farming supplies",
  registrationFee: "500",
  numberOfShares: "100",
  pricePerShare: "50",
  totalMembers: "10",
  maleMembers: "6",
  femaleMembers: "4",
  fixedAssets: "1000",
  currentAssets: "500",
};

describe("cooperativeSchema", () => {
  it("accepts a valid cooperative where member counts add up", () => {
    const result = cooperativeSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it("rejects when male + female members don't equal total members", () => {
    const result = cooperativeSchema.safeParse({ ...validBase, totalMembers: "11" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "totalMembers");
      expect(issue?.message).toMatch(/Male \+ Female members must equal Total members/);
    }
  });

  it("rejects a negative share count", () => {
    const result = cooperativeSchema.safeParse({ ...validBase, numberOfShares: "-5" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing required field", () => {
    const withoutName = { ...validBase };
    delete (withoutName as Record<string, unknown>).name;
    const result = cooperativeSchema.safeParse(withoutName);
    expect(result.success).toBe(false);
  });
});
