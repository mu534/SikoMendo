import {
  LayoutDashboard,
  UserCog,
  Users,
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

export type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Omit to show the item to every signed-in user (e.g. Dashboard, Profile). */
  requires?: Action;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/users", label: "Users", icon: UserCog, requires: "MANAGE_USERS" },
  { href: "/employees", label: "Employees", icon: Users, requires: "VIEW_EMPLOYEES" },
  { href: "/departments", label: "Departments", icon: Layers, requires: "VIEW_DEPARTMENTS" },
  { href: "/cooperatives", label: "Cooperatives", icon: Building2, requires: "VIEW_COOPERATIVES" },
  { href: "/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/leave", label: "Leave", icon: CalendarOff },
  { href: "/my-documents", label: "My Documents", icon: FileText },
  { href: "/reports", label: "Reports", icon: FileBarChart, requires: "VIEW_REPORTS" },
  { href: "/audit-log", label: "Audit Log", icon: ShieldCheck, requires: "VIEW_AUDIT_LOG" },
  { href: "/profile", label: "My Profile", icon: UserCircle },
];
