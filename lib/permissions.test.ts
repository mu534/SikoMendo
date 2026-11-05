import { describe, it, expect } from "vitest";
import { can, resolveEffectiveRoleSync } from "./permissions";

// These tests exist specifically to lock in the manager-only leave approval
// design: only MANAGER can decide leave requests; HR_OFFICER can see
// everything but not act on it; ADMIN can't see or act on leave at all
// (segregation of duties — Admin configures the system, doesn't rule on
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

  it("MANAGER can configure leave policy; HR_OFFICER and ADMIN cannot", () => {
    expect(can("MANAGER",    "MANAGE_LEAVE_POLICY")).toBe(true);
    expect(can("HR_OFFICER", "MANAGE_LEAVE_POLICY")).toBe(false);
    expect(can("ADMIN",      "MANAGE_LEAVE_POLICY")).toBe(false);
    expect(can("EMPLOYEE",   "MANAGE_LEAVE_POLICY")).toBe(false);
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

// ── DEPT_MANAGER base permission set (non-HR) ────────────────────────────────
// After the dynamic-role change, base DEPT_MANAGER is employee-equivalent.
// These tests lock in the stripped-down set so a future edit cannot accidentally
// re-add elevated permissions to the base set.
describe("DEPT_MANAGER base permissions (non-HR department)", () => {
  it("cannot manage or view all leave requests (employee-level only)", () => {
    expect(can("DEPT_MANAGER", "MANAGE_LEAVE")).toBe(false);
    expect(can("DEPT_MANAGER", "VIEW_ALL_LEAVE")).toBe(false);
  });

  it("cannot access dashboard analytics or reports", () => {
    expect(can("DEPT_MANAGER", "DASHBOARD_ANALYTICS")).toBe(false);
    expect(can("DEPT_MANAGER", "GENERATE_REPORTS")).toBe(false);
    expect(can("DEPT_MANAGER", "VIEW_REPORTS")).toBe(false);
  });

  it("cannot access lifecycle management", () => {
    expect(can("DEPT_MANAGER", "VIEW_LIFECYCLE")).toBe(false);
  });

  it("retains employee-level attendance and leave permissions", () => {
    expect(can("DEPT_MANAGER", "SELF_ATTENDANCE")).toBe(true);
    expect(can("DEPT_MANAGER", "MANAGE_OWN_LEAVE")).toBe(true);
  });

  it("retains read access to employees and departments", () => {
    expect(can("DEPT_MANAGER", "VIEW_EMPLOYEES")).toBe(true);
    expect(can("DEPT_MANAGER", "VIEW_DEPARTMENTS")).toBe(true);
  });

  it("retains own profile permissions", () => {
    expect(can("DEPT_MANAGER", "VIEW_OWN_PROFILE")).toBe(true);
    expect(can("DEPT_MANAGER", "UPDATE_OWN_INFO")).toBe(true);
  });
});

// ── resolveEffectiveRoleSync ─────────────────────────────────────────────────
describe("resolveEffectiveRoleSync()", () => {
  it("returns HR_OFFICER when DEPT_MANAGER is in the HR department", () => {
    expect(resolveEffectiveRoleSync("DEPT_MANAGER", true)).toBe("HR_OFFICER");
  });

  it("returns DEPT_MANAGER when DEPT_MANAGER is NOT in the HR department", () => {
    expect(resolveEffectiveRoleSync("DEPT_MANAGER", false)).toBe("DEPT_MANAGER");
  });

  it("returns the actual role unchanged for non-DEPT_MANAGER roles", () => {
    expect(resolveEffectiveRoleSync("EMPLOYEE", false)).toBe("EMPLOYEE");
    expect(resolveEffectiveRoleSync("EMPLOYEE", true)).toBe("EMPLOYEE");
    expect(resolveEffectiveRoleSync("HR_OFFICER", false)).toBe("HR_OFFICER");
    expect(resolveEffectiveRoleSync("MANAGER", false)).toBe("MANAGER");
    expect(resolveEffectiveRoleSync("ADMIN", false)).toBe("ADMIN");
  });
});
