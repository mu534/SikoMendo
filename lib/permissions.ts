export const ROLES = ["ADMIN", "HR_OFFICER", "MANAGER", "EMPLOYEE"] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN:      "Administrator",
  HR_OFFICER: "HR Officer",
  MANAGER:    "General Manager",
  EMPLOYEE:   "Employee",
};

export function roleLabel(role: string | undefined | null): string {
  if (!role) return "Unknown";
  return ROLE_LABELS[role as Role] ?? role;
}

export type Action =
  | "MANAGE_USERS"
  | "MANAGE_ROLES"
  | "MANAGE_EMPLOYEES"
  | "VIEW_EMPLOYEES"
  | "MANAGE_COOPERATIVES"
  | "VIEW_COOPERATIVES"
  | "MANAGE_ATTENDANCE"
  | "VIEW_ATTENDANCE"
  // Self attendance: all roles with an employee record can check in/out their own attendance.
  // Server actions derive the employee from the session — employeeId is never trusted from the client.
  | "SELF_ATTENDANCE"
  // Admin-only: configure the organisation attendance policy (work start time, grace period, etc.)
  | "MANAGE_ATTENDANCE_POLICY"
  | "MANAGE_DOCUMENTS"
  | "GENERATE_REPORTS"
  | "VIEW_REPORTS"
  | "DELETE_REPORTS"
  | "DASHBOARD_ANALYTICS"
  | "VIEW_OWN_PROFILE"
  | "UPDATE_OWN_INFO"
  | "VIEW_ALL_LEAVE"
  | "MANAGE_LEAVE"
  | "MANAGE_OWN_LEAVE"
  | "VIEW_AUDIT_LOG"
  | "MANAGE_LEAVE_POLICY"
  | "VIEW_DEPARTMENTS"
  | "MANAGE_DEPARTMENTS"
  | "MANAGE_POSITIONS"
  | "MANAGE_EMPLOYMENT_HISTORY"
  | "MANAGE_CONTRACTS"
  | "MANAGE_SETTINGS"
  // ── Lifecycle ──────────────────────────────────────────────────────────────
  // MANAGE_ONBOARDING: start/complete onboarding workflows
  | "MANAGE_ONBOARDING"
  // MANAGE_OFFBOARDING: initiate/complete offboarding, archive employees
  | "MANAGE_OFFBOARDING"
  // VIEW_LIFECYCLE: access the lifecycle dashboard and the lifecycle tab on profiles
  | "VIEW_LIFECYCLE";

// Define which actions each role can perform (hierarchical)
export const PERMISSIONS: Record<Role, Action[]> = {
  ADMIN: [
    "MANAGE_USERS",
    "MANAGE_ROLES",
    "MANAGE_EMPLOYEES",
    "VIEW_EMPLOYEES",
    "MANAGE_COOPERATIVES",
    "VIEW_COOPERATIVES",
    // ADMIN is the only role that can edit another employee's attendance record.
    // All other roles use self-attendance (SELF_ATTENDANCE) only.
    "MANAGE_ATTENDANCE",
    "VIEW_ATTENDANCE",
    "SELF_ATTENDANCE",
    "MANAGE_ATTENDANCE_POLICY",
    "MANAGE_DOCUMENTS",
    "GENERATE_REPORTS",
    "VIEW_REPORTS",
    "DELETE_REPORTS",
    "DASHBOARD_ANALYTICS",
    "VIEW_OWN_PROFILE",
    "UPDATE_OWN_INFO",
    "MANAGE_OWN_LEAVE",
    "VIEW_AUDIT_LOG",
    "VIEW_DEPARTMENTS",
    "MANAGE_DEPARTMENTS",
    "MANAGE_POSITIONS",
    "MANAGE_EMPLOYMENT_HISTORY",
    "MANAGE_CONTRACTS",
    "MANAGE_SETTINGS",
    "MANAGE_ONBOARDING",
    "MANAGE_OFFBOARDING",
    "VIEW_LIFECYCLE",
  ],
  HR_OFFICER: [
    "MANAGE_EMPLOYEES",
    "VIEW_EMPLOYEES",
    "MANAGE_COOPERATIVES",
    "VIEW_COOPERATIVES",
    // HR Officers can VIEW attendance org-wide (read-only register).
    // They can no longer MANAGE (edit) other employees' attendance — use SELF_ATTENDANCE for own.
    "VIEW_ATTENDANCE",
    "SELF_ATTENDANCE",
    "MANAGE_DOCUMENTS",
    "GENERATE_REPORTS",
    "VIEW_REPORTS",
    "DASHBOARD_ANALYTICS",
    "VIEW_OWN_PROFILE",
    "UPDATE_OWN_INFO",
    "VIEW_ALL_LEAVE",
    "MANAGE_OWN_LEAVE",
    "MANAGE_LEAVE_POLICY",
    "VIEW_DEPARTMENTS",
    "MANAGE_DEPARTMENTS",
    "MANAGE_POSITIONS",
    "MANAGE_EMPLOYMENT_HISTORY",
    "MANAGE_CONTRACTS",
    "MANAGE_ONBOARDING",
    "MANAGE_OFFBOARDING",
    "VIEW_LIFECYCLE",
  ],
  MANAGER: [
    "VIEW_EMPLOYEES",
    "VIEW_COOPERATIVES",
    // MANAGER can VIEW attendance (scoped to their reporting hierarchy in queries).
    // They can no longer mark/edit any employee's attendance — use SELF_ATTENDANCE for own.
    "VIEW_ATTENDANCE",
    "SELF_ATTENDANCE",
    "GENERATE_REPORTS",
    "VIEW_REPORTS",
    "DASHBOARD_ANALYTICS",
    "VIEW_OWN_PROFILE",
    "UPDATE_OWN_INFO",
    "VIEW_ALL_LEAVE",
    "MANAGE_LEAVE",
    "MANAGE_OWN_LEAVE",
    "MANAGE_LEAVE_POLICY",
    "VIEW_DEPARTMENTS",
  ],
  EMPLOYEE: [
    "VIEW_OWN_PROFILE",
    "UPDATE_OWN_INFO",
    "MANAGE_OWN_LEAVE",
    // Employees can check in/out their own attendance only.
    "SELF_ATTENDANCE",
  ],
};

export function can(role: string | undefined, action: Action) {
  if (!role) return false;
  const perms = PERMISSIONS[role as Role];
  if (!perms) return false;
  return perms.includes(action);
}

const permissions = { ROLES, PERMISSIONS, can };
export default permissions;
