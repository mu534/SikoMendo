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
  SlidersHorizontal,
  DatabaseBackup,
  Activity,
} from "lucide-react";
import type { Action } from "@/lib/permissions";

/** A simple link item. */
export type NavItem = {
  kind?: "item";
  href: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
  requires?: Action;
};

/** A collapsible group that contains child link items. */
export type NavGroup = {
  kind: "group";
  labelKey: string;
  icon: typeof LayoutDashboard;
  requires?: Action;
  activePrefix: string;
  children: Array<{
    href: string;
    labelKey: string;
    icon: typeof LayoutDashboard;
    requires?: Action;
  }>;
};

export type AnyNavItem = NavItem | NavGroup;

export const NAV_ITEMS: AnyNavItem[] = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },

  // ── Users group ──────────────────────────────────────────────────────────
  {
    kind: "group",
    labelKey: "nav.users",
    icon: UserCog,
    requires: "MANAGE_USERS",
    activePrefix: "/users",
    children: [
      { href: "/users",           labelKey: "nav.allAccounts",       icon: Users,  requires: "MANAGE_USERS" },
      { href: "/users/suspended", labelKey: "nav.suspendedAccounts", icon: UserX,  requires: "MANAGE_USERS" },
    ],
  },

  // ── Employees group ──────────────────────────────────────────────────────
  {
    kind: "group",
    labelKey: "nav.employees",
    icon: Users,
    requires: "VIEW_EMPLOYEES",
    activePrefix: "/employees",
    children: [
      { href: "/employees",            labelKey: "nav.employeeList",  icon: Users,    requires: "VIEW_EMPLOYEES" },
      { href: "/employees/lifecycle",  labelKey: "nav.lifecycle",     icon: Activity, requires: "VIEW_LIFECYCLE" },
      { href: "/employees/new",        labelKey: "nav.newEmployee",   icon: UserPlus, requires: "MANAGE_EMPLOYEES" },
      { href: "/employees?archived=1", labelKey: "nav.archived",      icon: Archive,  requires: "MANAGE_EMPLOYEES" },
      { href: "/employees/import",     labelKey: "nav.bulkImport",    icon: Upload,   requires: "MANAGE_EMPLOYEES" },
    ],
  },

  // ── Cooperatives group ──────────────────────────────────────────────────
  {
    kind: "group",
    labelKey: "nav.cooperatives",
    icon: Building2,
    requires: "VIEW_COOPERATIVES",
    activePrefix: "/cooperatives",
    children: [
      { href: "/cooperatives",            labelKey: "nav.cooperativeList",  icon: Building2, requires: "VIEW_COOPERATIVES" },
      { href: "/cooperatives/new",        labelKey: "nav.newCooperative",   icon: UserPlus,  requires: "MANAGE_COOPERATIVES" },
      { href: "/cooperatives?archived=1", labelKey: "nav.archived",         icon: Archive,   requires: "MANAGE_COOPERATIVES" },
    ],
  },

  { href: "/departments",  labelKey: "nav.departments", icon: Layers, requires: "VIEW_DEPARTMENTS" },

  // ── Attendance group ──────────────────────────────────────────────────────
  {
    kind: "group",
    labelKey: "nav.attendance",
    icon: CalendarCheck,
    activePrefix: "/attendance",
    children: [
      { href: "/attendance/mine",       labelKey: "nav.myAttendance",         icon: CalendarCheck                                          },
      { href: "/attendance/management", labelKey: "nav.attendanceManagement", icon: CalendarCheck, requires: "MANAGE_ATTENDANCE"          },
      { href: "/attendance/monitoring", labelKey: "nav.attendanceMonitoring", icon: CalendarCheck, requires: "VIEW_ATTENDANCE_MONITOR"    },
      { href: "/attendance/policy",     labelKey: "nav.attendancePolicy",     icon: ShieldCheck,   requires: "MANAGE_ATTENDANCE_POLICY"   },
    ],
  },

  // ── Leave group ──────────────────────────────────────────────────────────
  {
    kind: "group",
    labelKey: "nav.leave",
    icon: CalendarOff,
    activePrefix: "/leave",
    children: [
      { href: "/leave",        labelKey: "nav.leaveRequests", icon: CalendarOff },
      { href: "/leave/policy", labelKey: "nav.leavePolicy",   icon: ShieldCheck, requires: "MANAGE_LEAVE_POLICY" },
    ],
  },
  { href: "/my-documents", labelKey: "nav.myDocuments", icon: FileText },

  // ── Reports group ─────────────────────────────────────────────────────────
  {
    kind: "group",
    labelKey: "nav.reports",
    icon: FileBarChart,
    requires: "VIEW_REPORTS",
    activePrefix: "/reports",
    children: [
      { href: "/reports",         labelKey: "nav.generateReport", icon: FileBarChart, requires: "GENERATE_REPORTS" },
      { href: "/reports/history", labelKey: "nav.reportHistory",  icon: FileText,     requires: "VIEW_REPORTS" },
    ],
  },

  { href: "/audit-log", labelKey: "nav.auditLog", icon: ShieldCheck, requires: "VIEW_AUDIT_LOG" },

  // ── Settings group ────────────────────────────────────────────────────────
  {
    kind: "group",
    labelKey: "nav.settings",
    icon: SlidersHorizontal,
    requires: "MANAGE_SETTINGS",
    activePrefix: "/settings",
    children: [
      { href: "/settings/organization", labelKey: "nav.organisation",   icon: Building2,     requires: "MANAGE_SETTINGS" },
      { href: "/settings/backup",       labelKey: "nav.backupRestore",  icon: DatabaseBackup, requires: "MANAGE_SETTINGS" },
      { href: "/settings/security",     labelKey: "nav.security",       icon: ShieldCheck,   requires: "MANAGE_SETTINGS" },
    ],
  },

  { href: "/profile", labelKey: "nav.myProfile", icon: UserCircle },
];
