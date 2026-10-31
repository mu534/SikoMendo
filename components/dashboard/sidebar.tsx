"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useState } from "react";
import { Sprout, X, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { NAV_ITEMS, type NavGroup, type AnyNavItem } from "@/components/dashboard/nav-config";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { OrgBranding } from "@/components/dashboard/dashboard-shell";

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
  const t = useTranslations();
  const groupActive = pathname.includes(group.activePrefix);
  const [open, setOpen] = useState(false);
  const isOpen = groupActive || open;

  const visibleChildren = group.children.filter(
    (child) => !child.requires || can(role, child.requires)
  );

  if (visibleChildren.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition",
          groupActive
            ? "bg-brand-800 text-white"
            : "text-brand-100/80 hover:bg-brand-800 hover:text-white"
        )}
        aria-expanded={isOpen}
      >
        <group.icon className="h-[18px] w-[18px] shrink-0" />
        <span className="flex-1 text-left">{t(group.labelKey)}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-brand-200/50 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <div className="ml-3 mt-0.5 border-l border-brand-700/50 pl-3 space-y-0.5">
          {visibleChildren.map((child) => {
            const hrefBase = child.href.split("?")[0];
            const active =
              pathname === hrefBase && !child.href.includes("?");

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
                {t(child.labelKey)}
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
  org,
}: {
  role: string;
  mobileOpen: boolean;
  onClose: () => void;
  org: OrgBranding;
}) {
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <>
      {mobileOpen && (
        <button
          aria-label={t("common.closeNavigation")}
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
        {/* Logo / org name */}
        <div className="flex items-center justify-between gap-3 px-6 py-5">
          <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
            {org.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={org.logoUrl}
                alt={org.orgName}
                className="h-9 w-9 rounded-xl object-contain bg-brand-700/60"
              />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-700/60 text-brand-100">
                <Sprout className="h-5 w-5" />
              </span>
            )}
            <span className="font-display leading-tight text-white">
              <span className="block text-sm font-semibold">{org.orgName}</span>
              <span className="block text-[11px] uppercase tracking-wider text-brand-200/70">
                {org.tagline}
              </span>
            </span>
          </Link>
          <button
            onClick={onClose}
            className="text-brand-200/70 hover:text-white lg:hidden"
            aria-label={t("common.closeMenu")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-2">
          {NAV_ITEMS.map((item: AnyNavItem) => {
            if (item.kind === "group") {
              if (item.requires && !can(role, item.requires)) return null;
              return (
                <CollapsibleGroup
                  key={item.labelKey}
                  group={item}
                  role={role}
                  pathname={pathname}
                  onLinkClick={onClose}
                />
              );
            }

            if (item.requires && !can(role, item.requires)) return null;
            const active =
              pathname === item.href || pathname.includes(`${item.href}/`);
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
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-6 py-5 text-xs text-brand-200/60">
          © {new Date().getFullYear()} {org.orgName}
          <br />
          {org.location}
        </div>
      </aside>
    </>
  );
}
