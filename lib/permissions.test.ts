import { describe, it, expect } from "vitest";
import { can } from "./permissions";

// These tests exist specifically to lock in the manager-only leave approval
// design: only MANAGER can decide leave requests; HR_OFFICER can see
// everything but not act on it; ADMIN can't see or act on leave at all
// (segregation of duties \u2014 Admin configures the system, doesn't rule on
// individual requests). If someone edits lib/permissions.ts and one of
// these breaks, that's a real regression of a deliberate decision, not a
// false alarm.
describe("leave approval permissions", () => {
  it("only MANAGER can decide (approve/reject) leave requests", () => {
    expect(can("MANAGER", "MANAGE_LEAVE")).toBe(true);
    expect(can("HR_OFFICER", "MANAGE_LEAVE")).toBe(false);
    expect(can("ADMIN", "MANAGE_LEAVE")).toBe(false);
    expect(can("EMPLOYEE", "MANAGE_LEAVE")).toBe(false);
  });

  it("HR_OFFICER can view all leave requests (read-only oversight) but ADMIN cannot", () => {
    expect(can("HR_OFFICER", "VIEW_ALL_LEAVE")).toBe(true);
    expect(can("MANAGER", "VIEW_ALL_LEAVE")).toBe(true);
    expect(can("ADMIN", "VIEW_ALL_LEAVE")).toBe(false);
  });

  it("every role can manage their own leave requests (submit/cancel their own)", () => {
    expect(can("ADMIN", "MANAGE_OWN_LEAVE")).toBe(true);
    expect(can("HR_OFFICER", "MANAGE_OWN_LEAVE")).toBe(true);
    expect(can("MANAGER", "MANAGE_OWN_LEAVE")).toBe(true);
    expect(can("EMPLOYEE", "MANAGE_OWN_LEAVE")).toBe(true);
  });

  it("MANAGER and HR_OFFICER can both configure leave policy — HR_OFFICER for system-wide oversight, MANAGER as the responsible operational role", () => {
    expect(can("HR_OFFICER", "MANAGE_LEAVE_POLICY")).toBe(true);
    expect(can("MANAGER", "MANAGE_LEAVE_POLICY")).toBe(true);
    expect(can("ADMIN", "MANAGE_LEAVE_POLICY")).toBe(false);
    expect(can("EMPLOYEE", "MANAGE_LEAVE_POLICY")).toBe(false);
  });
});

describe("can()", () => {
  it("returns false for an unknown/undefined role rather than throwing", () => {
    expect(can(undefined, "MANAGE_LEAVE")).toBe(false);
    expect(can("NOT_A_REAL_ROLE", "MANAGE_LEAVE")).toBe(false);
  });

  it("ADMIN retains system-configuration and user-management permissions", () => {
    expect(can("ADMIN", "MANAGE_USERS")).toBe(true);
    expect(can("HR_OFFICER", "MANAGE_USERS")).toBe(false);
  });
});
