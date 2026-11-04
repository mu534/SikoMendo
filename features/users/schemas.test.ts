/**
 * Tests for features/users/schemas.ts — createManagerWithEmployeeSchema
 *
 * Covers the schema-level validation rejection cases for the bootstrapping
 * action (createManagerWithEmployee). These run without a live database and
 * verify the discriminated-union validation rules so regressions are caught
 * at the unit level.
 *
 * Scenarios tested:
 *  1. Valid MANAGER (General Manager) payload accepted
 *  2. Valid DEPT_MANAGER payload accepted
 *  3. DEPT_MANAGER rejected when departmentId is missing
 *  4. MANAGER accepted when departmentId is absent (not required for GM)
 *  5. Invalid managerType rejected
 *  6. Missing required personal fields rejected (firstName, lastName, middleName)
 *  7. Invalid gender rejected
 *  8. Invalid maritalStatus rejected
 *  9. Invalid employmentType rejected
 * 10. Date of birth in the future rejected
 * 11. Employee under 20 years old rejected
 * 12. Employee exactly 20 years old rejected (must be STRICTLY older than 20)
 * 13. Employee exactly 21 years old accepted
 * 14. Employee 20 years and 364 days old rejected
 * 15. Invalid email format rejected
 * 16. Optional email accepted when omitted
 * 17. Optional email accepted when empty string (normalized to null)
 * 18. positionId is not required (field removed from schema)
 */

import { describe, it, expect } from "vitest";
import { createManagerWithEmployeeSchema } from "./schemas";

// ── Shared base payload (GM variant — no departmentId needed) ────────────────

const twentyFiveYearsAgo = new Date();
twentyFiveYearsAgo.setFullYear(twentyFiveYearsAgo.getFullYear() - 25);
const dob = twentyFiveYearsAgo.toISOString().split("T")[0]; // "YYYY-MM-DD"

const baseGM = {
  managerType:    "MANAGER" as const,
  firstName:      "Abebe",
  middleName:     "Bikila",
  lastName:       "Tadesse",
  phone:          "+251911234567",
  gender:         "MALE" as const,
  dateOfBirth:    dob,
  maritalStatus:  "SINGLE" as const,
  hireDate:       "2024-01-01",
  employmentType: "PERMANENT" as const,
};

const baseDM = {
  ...baseGM,
  managerType:  "DEPT_MANAGER" as const,
  departmentId: "dept-001",
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe("createManagerWithEmployeeSchema — MANAGER variant", () => {
  it("accepts a valid General Manager payload", () => {
    const result = createManagerWithEmployeeSchema.safeParse(baseGM);
    expect(result.success).toBe(true);
  });

  it("accepts GM payload without a departmentId (not required)", () => {
    const { ...nodept } = baseGM;
    const result = createManagerWithEmployeeSchema.safeParse(nodept);
    expect(result.success).toBe(true);
  });

  it("accepts optional email when absent", () => {
    const result = createManagerWithEmployeeSchema.safeParse(baseGM);
    expect(result.success).toBe(true);
    if (result.success) {
      // email should be absent / null when not provided
      expect((result.data as { email?: unknown }).email ?? null).toBeNull();
    }
  });

  it("accepts optional email when valid", () => {
    const result = createManagerWithEmployeeSchema.safeParse({
      ...baseGM,
      email: "abebe@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email format", () => {
    const result = createManagerWithEmployeeSchema.safeParse({
      ...baseGM,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("treats empty email string as null (optional field)", () => {
    const result = createManagerWithEmployeeSchema.safeParse({
      ...baseGM,
      email: "",
    });
    // Empty email is treated as absent — should be valid
    expect(result.success).toBe(true);
  });

  it("accepts without positionId (field no longer required)", () => {
    // positionId was removed from the schema; payload without it must succeed
    const result = createManagerWithEmployeeSchema.safeParse(baseGM);
    expect(result.success).toBe(true);
  });
});

describe("createManagerWithEmployeeSchema — DEPT_MANAGER variant", () => {
  it("accepts a valid Department Manager payload with departmentId", () => {
    const result = createManagerWithEmployeeSchema.safeParse(baseDM);
    expect(result.success).toBe(true);
  });

  it("rejects DEPT_MANAGER when departmentId is missing", () => {
    const { departmentId: _omit, ...noDept } = baseDM;
    const result = createManagerWithEmployeeSchema.safeParse({
      ...noDept,
      managerType: "DEPT_MANAGER",
    });
    expect(result.success).toBe(false);
  });

  it("rejects DEPT_MANAGER when departmentId is an empty string", () => {
    const result = createManagerWithEmployeeSchema.safeParse({
      ...baseDM,
      departmentId: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("createManagerWithEmployeeSchema — managerType validation", () => {
  it("rejects an invalid managerType value", () => {
    const result = createManagerWithEmployeeSchema.safeParse({
      ...baseGM,
      managerType: "EMPLOYEE",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing managerType", () => {
    const { managerType: _omit, ...rest } = baseGM;
    const result = createManagerWithEmployeeSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

describe("createManagerWithEmployeeSchema — personal information validation", () => {
  it("rejects when firstName is missing", () => {
    const result = createManagerWithEmployeeSchema.safeParse({
      ...baseGM,
      firstName: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects when middleName is missing", () => {
    const result = createManagerWithEmployeeSchema.safeParse({
      ...baseGM,
      middleName: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects when lastName is missing", () => {
    const result = createManagerWithEmployeeSchema.safeParse({
      ...baseGM,
      lastName: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid gender value", () => {
    const result = createManagerWithEmployeeSchema.safeParse({
      ...baseGM,
      gender: "OTHER",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid maritalStatus value", () => {
    const result = createManagerWithEmployeeSchema.safeParse({
      ...baseGM,
      maritalStatus: "ENGAGED",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a date of birth in the future", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const result = createManagerWithEmployeeSchema.safeParse({
      ...baseGM,
      dateOfBirth: tomorrow.toISOString().split("T")[0],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an employee under 20 years old", () => {
    const eighteenYearsAgo = new Date();
    eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
    const result = createManagerWithEmployeeSchema.safeParse({
      ...baseGM,
      dateOfBirth: eighteenYearsAgo.toISOString().split("T")[0],
    });
    expect(result.success).toBe(false);
  });

  it("rejects someone exactly 20 years old today", () => {
    // Born exactly 20 years ago — not strictly older than 20, must be rejected
    const today = new Date();
    const exactlyTwenty = new Date(
      today.getFullYear() - 20,
      today.getMonth(),
      today.getDate()
    );
    const result = createManagerWithEmployeeSchema.safeParse({
      ...baseGM,
      dateOfBirth: exactlyTwenty.toISOString().split("T")[0],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("The manager must be older than 20 years.");
    }
  });

  it("rejects someone 20 years and 364 days old (one day short of 21)", () => {
    // Born one day after the 21-year threshold — still under 21, must be rejected
    const today = new Date();
    const almostTwentyOne = new Date(
      today.getFullYear() - 21,
      today.getMonth(),
      today.getDate() + 1
    );
    const result = createManagerWithEmployeeSchema.safeParse({
      ...baseGM,
      dateOfBirth: almostTwentyOne.toISOString().split("T")[0],
    });
    expect(result.success).toBe(false);
  });

  it("accepts someone exactly 21 years old today", () => {
    // Born exactly 21 years ago today — has had their 21st birthday, strictly older than 20
    const today = new Date();
    const exactlyTwentyOne = new Date(
      today.getFullYear() - 21,
      today.getMonth(),
      today.getDate()
    );
    const result = createManagerWithEmployeeSchema.safeParse({
      ...baseGM,
      dateOfBirth: exactlyTwentyOne.toISOString().split("T")[0],
    });
    expect(result.success).toBe(true);
  });
});

describe("createManagerWithEmployeeSchema — employment information validation", () => {
  it("rejects an invalid employmentType value", () => {
    const result = createManagerWithEmployeeSchema.safeParse({
      ...baseGM,
      employmentType: "FULLTIME",
    });
    expect(result.success).toBe(false);
  });

  it("rejects when hireDate is missing", () => {
    const result = createManagerWithEmployeeSchema.safeParse({
      ...baseGM,
      hireDate: "",
    });
    expect(result.success).toBe(false);
  });
});
