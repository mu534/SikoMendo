export const ROLES = ["ADMIN", "HR_OFFICER", "MANAGER", "EMPLOYEE"] as const;

export type Role = (typeof ROLES)[number];

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
  | "UPDATE_OWN_INFO";

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
  ],
  MANAGER: [
    "VIEW_EMPLOYEES",
    "VIEW_COOPERATIVES",
    "VIEW_ATTENDANCE",
    "VIEW_REPORTS",
    "DASHBOARD_ANALYTICS",
    "VIEW_OWN_PROFILE",
    "UPDATE_OWN_INFO",
  ],
  EMPLOYEE: ["VIEW_OWN_PROFILE", "UPDATE_OWN_INFO"],
};

export function can(role: string | undefined, action: Action) {
  if (!role) return false;
  const perms = PERMISSIONS[role as Role];
  if (!perms) return false;
  return perms.includes(action);
}

export default { ROLES, PERMISSIONS, can };
