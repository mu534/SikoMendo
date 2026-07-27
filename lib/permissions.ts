export const ROLES = ["ADMIN", "HR_OFFICER", "MANAGER", "EMPLOYEE"] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrator",
  HR_OFFICER: "HR Officer",
  MANAGER: "Manager",
  EMPLOYEE: "Employee",
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
  | "MANAGE_DOCUMENTS"
  | "GENERATE_REPORTS"
  | "VIEW_REPORTS"
  | "DASHBOARD_ANALYTICS"
  | "VIEW_OWN_PROFILE"
  | "UPDATE_OWN_INFO"
  | "VIEW_ALL_LEAVE"
  | "MANAGE_LEAVE"
  | "MANAGE_OWN_LEAVE"
  | "VIEW_AUDIT_LOG";

// Define which actions each role can perform (hierarchical)
export const PERMISSIONS: Record<Role, Action[]> = {
  ADMIN: [
    "MANAGE_USERS",
    "MANAGE_ROLES",
    "MANAGE_EMPLOYEES",
    "VIEW_EMPLOYEES",
    "MANAGE_COOPERATIVES",
    "VIEW_COOPERATIVES",
    "MANAGE_ATTENDANCE",
    "VIEW_ATTENDANCE",
    "MANAGE_DOCUMENTS",
    "GENERATE_REPORTS",
    "VIEW_REPORTS",
    "DASHBOARD_ANALYTICS",
    "VIEW_OWN_PROFILE",
    "UPDATE_OWN_INFO",
    "VIEW_ALL_LEAVE",
    "MANAGE_LEAVE",
    "MANAGE_OWN_LEAVE",
    "VIEW_AUDIT_LOG",
  ],
  HR_OFFICER: [
    "MANAGE_EMPLOYEES",
    "VIEW_EMPLOYEES",
    "MANAGE_COOPERATIVES",
    "VIEW_COOPERATIVES",
    "MANAGE_ATTENDANCE",
    "VIEW_ATTENDANCE",
    "MANAGE_DOCUMENTS",
    "GENERATE_REPORTS",
    "VIEW_REPORTS",
    "DASHBOARD_ANALYTICS",
    "VIEW_OWN_PROFILE",
    "UPDATE_OWN_INFO",
    "MANAGE_OWN_LEAVE",
  ],
  MANAGER: [
    "VIEW_EMPLOYEES",
    "VIEW_COOPERATIVES",
    "VIEW_ATTENDANCE",
    "VIEW_REPORTS",
    "DASHBOARD_ANALYTICS",
    "VIEW_OWN_PROFILE",
    "UPDATE_OWN_INFO",
    "VIEW_ALL_LEAVE",
    "MANAGE_LEAVE",
    "MANAGE_OWN_LEAVE",
  ],
  EMPLOYEE: ["VIEW_OWN_PROFILE", "UPDATE_OWN_INFO", "MANAGE_OWN_LEAVE"],
};

export function can(role: string | undefined, action: Action) {
  if (!role) return false;
  const perms = PERMISSIONS[role as Role];
  if (!perms) return false;
  return perms.includes(action);
}

export default { ROLES, PERMISSIONS, can };