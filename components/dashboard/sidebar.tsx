"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Sprout, X, ChevronDown } from "lucide-react";
import { NAV_ITEMS, type NavGroup, type AnyNavItem } from "@/components/dashboard/nav-config";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";

// ── CollapsibleGroup ─────────────────────────────────────────────────────────

function CollapsibleGroup({
  group,
  role,
  pathname,
  onLinkClick,
}: {
  group: NavGroup;
  role: string;
  pathname: string;
  onLinkClick: () => void;
}) {
  const groupActive = pathname.startsWith(group.activePrefix);
  const [open, setOpen] = useState(groupActive);

  useEffect(() => {
    if (groupActive) setOpen(true);
  }, [groupActive]);

  const visibleChildren = group.children.filter(
    (child) => !child.requires || can(role, child.requires)
  );

  if (visibleChildren.length === 0) return null;

  return (
    <div>
      {/* ── Parent toggle — same weight as top-level items ── */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition",
          groupActive
            ? "bg-brand-800 text-white"
            : "text-brand-100/80 hover:bg-brand-800 hover:text-white"
        )}
        aria-expanded={open}
      >
        <group.icon className="h-[18px] w-[18px] shrink-0" />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-brand-200/50 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {/* ── Children — visually subordinate ── */}
      {open && (
        <div className="ml-3 mt-0.5 border-l border-brand-700/50 pl-3 space-y-0.5">
          {visibleChildren.map((child) => {
            const active =
              pathname === child.href.split("?")[0] &&
              !child.href.includes("?");

            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onLinkClick}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition",
                  active
                    ? "bg-brand-700 text-white"
                    : "text-brand-200/70 hover:bg-brand-800/60 hover:text-white"
                )}
              >
                <child.icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export function Sidebar({
  role,
  mobileOpen,
  onClose,
}: {
  role: string;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {mobileOpen && (
        <button
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-ink-900/40 lg:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-brand-900 transition-transform",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between gap-3 px-6 py-5">
          <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-700/60 text-brand-100">
              <Sprout className="h-5 w-5" />
            </span>
            <span className="font-display leading-tight text-white">
              <span className="block text-sm font-semibold">Siko Mendo</span>
              <span className="block text-[11px] uppercase tracking-wider text-brand-200/70">
                Union HRMIS
              </span>
            </span>
          </Link>
          <button
            onClick={onClose}
            className="text-brand-200/70 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-2">
          {NAV_ITEMS.map((item: AnyNavItem) => {
            // ── Group ──────────────────────────────────────────────────────
            if (item.kind === "group") {
              if (item.requires && !can(role, item.requires)) return null;
              return (
                <CollapsibleGroup
                  key={item.label}
                  group={item}
                  role={role}
                  pathname={pathname}
                  onLinkClick={onClose}
                />
              );
            }

            // ── Flat item ──────────────────────────────────────────────────
            if (item.requires && !can(role, item.requires)) return null;
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-brand-700 text-white"
                    : "text-brand-100/80 hover:bg-brand-800 hover:text-white"
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-6 py-5 text-xs text-brand-200/60">
          © {new Date().getFullYear()} Siko Mendo Union
          <br />
          Bale Robe, Ethiopia
        </div>
      </aside>
    </>
  );
}
