"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sprout, X } from "lucide-react";
import { NAV_ITEMS } from "@/components/dashboard/nav-config";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";

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
  const items = NAV_ITEMS.filter((item) => !item.requires || can(role, item.requires));

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
          // Always fixed — both mobile and desktop — so it never scrolls with
          // the page content. On desktop it's always visible; on mobile it
          // slides in/out via translate.
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-brand-900 transition-transform",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex items-center justify-between gap-3 px-6 py-5">
          <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-700/60 text-brand-100">
              <Sprout className="h-5 w-5" />
            </span>
            <span className="font-display leading-tight text-white">
              <span className="block text-sm font-semibold">Siko Mendo</span>
              <span className="block text-[11px] uppercase tracking-wider text-brand-200/70">Union HRMIS</span>
            </span>
          </Link>
          <button onClick={onClose} className="text-brand-200/70 hover:text-white lg:hidden" aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-2">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                  active ? "bg-brand-700 text-white" : "text-brand-100/80 hover:bg-brand-800 hover:text-white"
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-6 py-5 text-xs text-brand-200/60">
          © {new Date().getFullYear()} Siko Mendo Union
          <br />
          Bale Robe, Ethiopia
        </div>
      </aside>
    </>
  );
}
