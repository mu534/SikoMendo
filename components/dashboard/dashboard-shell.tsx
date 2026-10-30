"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";
import { NAV_ITEMS } from "@/components/dashboard/nav-config";

export type OrgBranding = {
  orgName: string;
  tagline: string;
  location: string;
  logoUrl: string | null;
};

export function DashboardShell({
  user,
  notifications,
  org,
  children,
}: {
  user: { name: string; email: string; role: string; image?: string | null };
  notifications: { items: { id: string; type: string; title: string; message: string; isRead: boolean; createdAt: Date }[]; unreadCount: number };
  org: OrgBranding;
  children: React.ReactNode;
}) {
  const t = useTranslations();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Find the active nav item to derive the page title
  const activeItem = NAV_ITEMS.find((item) => {
    if (item.kind === "group") {
      // Check children first for more specific match
      return item.children.some(
        (child) => pathname.includes(child.href.split("?")[0])
      );
    }
    return pathname.includes(item.href);
  });

  // Derive the page title from the active nav item's translation key,
  // or from matching a child item for groups.
  let pageTitleKey = "nav.dashboard";
  if (activeItem) {
    if (activeItem.kind === "group") {
      const activeChild = activeItem.children.find((child) =>
        pathname.includes(child.href.split("?")[0])
      );
      pageTitleKey = activeChild?.labelKey ?? activeItem.labelKey;
    } else {
      pageTitleKey = activeItem.labelKey;
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={user.role} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} org={org} />

      {/* lg:pl-64 offsets the fixed sidebar width on desktop */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden lg:pl-64">
        <Header
          pageTitle={t(pageTitleKey)}
          user={user}
          notifications={notifications}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-y-auto bg-sand-50 p-4 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
