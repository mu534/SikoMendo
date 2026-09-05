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
  UserX,
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
  requires?: Action;
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

  // ── Users group ──────────────────────────────────────────────────────────
  {
    kind: "group",
    label: "Users",
    icon: UserCog,
    requires: "MANAGE_USERS",
    activePrefix: "/users",
    children: [
      { href: "/users",           label: "All Accounts",       icon: Users,  requires: "MANAGE_USERS" },
      { href: "/users/suspended", label: "Suspended Accounts", icon: UserX,  requires: "MANAGE_USERS" },
    ],
  },

  // ── Employees group ──────────────────────────────────────────────────────
  {
    kind: "group",
    label: "Employees",
    icon: Users,
    requires: "VIEW_EMPLOYEES",
    activePrefix: "/employees",
    children: [
      { href: "/employees",            label: "Employee List",   icon: Users,    requires: "VIEW_EMPLOYEES" },
      { href: "/employees/new",        label: "New Employee",    icon: UserPlus, requires: "MANAGE_EMPLOYEES" },
      { href: "/employees?archived=1", label: "Archived",        icon: Archive,  requires: "MANAGE_EMPLOYEES" },
      { href: "/employees/import",     label: "Bulk Import",     icon: Upload,   requires: "MANAGE_EMPLOYEES" },
    ],
  },

  // ── Cooperatives group ──────────────────────────────────────────────────
  {
    kind: "group",
    label: "Cooperatives",
    icon: Building2,
    requires: "VIEW_COOPERATIVES",
    activePrefix: "/cooperatives",
    children: [
      { href: "/cooperatives",            label: "Cooperative List",   icon: Building2, requires: "VIEW_COOPERATIVES" },
      { href: "/cooperatives/new",        label: "New Cooperative",    icon: UserPlus,  requires: "MANAGE_COOPERATIVES" },
      { href: "/cooperatives?archived=1", label: "Archived",           icon: Archive,   requires: "MANAGE_COOPERATIVES" },
    ],
  },

  { href: "/departments",  label: "Departments",  icon: Layers,        requires: "VIEW_DEPARTMENTS" },
  { href: "/attendance",   label: "Attendance",   icon: CalendarCheck },

  // ── Leave group ──────────────────────────────────────────────────────────
  {
    kind: "group",
    label: "Leave",
    icon: CalendarOff,
    activePrefix: "/leave",
    children: [
      { href: "/leave",        label: "Leave Requests", icon: CalendarOff },
      { href: "/leave/policy", label: "Leave Policy",   icon: ShieldCheck, requires: "MANAGE_LEAVE_POLICY" },
    ],
  },
  { href: "/my-documents", label: "My Documents", icon: FileText },
  { href: "/reports",      label: "Reports",      icon: FileBarChart,  requires: "VIEW_REPORTS" },
  { href: "/audit-log",    label: "Audit Log",    icon: ShieldCheck,   requires: "VIEW_AUDIT_LOG" },
  { href: "/profile",      label: "My Profile",   icon: UserCircle },
];
