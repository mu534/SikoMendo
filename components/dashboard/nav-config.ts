import {
  LayoutDashboard,
  UserCog,
  Users,
  UserPlus,
  Upload,
  Archive,
  Building2,
  Layers,
  CalendarCheck,
  CalendarOff,
  FileBarChart,
  FileText,
  ShieldCheck,
  UserCircle,
} from "lucide-react";
import type { Action } from "@/lib/permissions";

/** A simple link item. */
export type NavItem = {
  kind?: "item";
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  requires?: Action;
};

/** A collapsible group that contains child link items. */
export type NavGroup = {
  kind: "group";
  label: string;
  icon: typeof LayoutDashboard;
  /** The group is visible when the user has at least this permission. */
  requires?: Action;
  /**
   * Prefix used to determine whether the group should be treated as active.
   * Any pathname starting with this prefix activates the group.
   */
  activePrefix: string;
  children: Array<{
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
    requires?: Action;
  }>;
};

export type AnyNavItem = NavItem | NavGroup;

export const NAV_ITEMS: AnyNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/users", label: "Users", icon: UserCog, requires: "MANAGE_USERS" },

  // ── Employees group ──────────────────────────────────────────────────────
  {
    kind: "group",
    label: "Employees",
    icon: Users,
    requires: "VIEW_EMPLOYEES",
    activePrefix: "/employees",
    children: [
      { href: "/employees",          label: "Employee List",   icon: Users,    requires: "VIEW_EMPLOYEES" },
      { href: "/employees/new",      label: "New Employee",    icon: UserPlus, requires: "MANAGE_EMPLOYEES" },
      { href: "/employees?archived=1", label: "Archived",      icon: Archive,  requires: "MANAGE_EMPLOYEES" },
      { href: "/employees/import",   label: "Bulk Import",     icon: Upload,   requires: "MANAGE_EMPLOYEES" },
    ],
  },

  { href: "/departments",  label: "Departments",  icon: Layers,        requires: "VIEW_DEPARTMENTS" },
  { href: "/cooperatives", label: "Cooperatives", icon: Building2,     requires: "VIEW_COOPERATIVES" },
  { href: "/attendance",   label: "Attendance",   icon: CalendarCheck },
  { href: "/leave",        label: "Leave",        icon: CalendarOff },
  { href: "/my-documents", label: "My Documents", icon: FileText },
  { href: "/reports",      label: "Reports",      icon: FileBarChart,  requires: "VIEW_REPORTS" },
  { href: "/audit-log",    label: "Audit Log",    icon: ShieldCheck,   requires: "VIEW_AUDIT_LOG" },
  { href: "/profile",      label: "My Profile",   icon: UserCircle },
];
