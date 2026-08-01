"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";
import { NAV_ITEMS } from "@/components/dashboard/nav-config";

export function DashboardShell({
  user,
  notifications,
  children,
}: {
  user: { name: string; email: string; role: string; image?: string | null };
  notifications: { items: { id: string; type: string; title: string; message: string; isRead: boolean; createdAt: Date }[]; unreadCount: number };
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const activeItem = NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  return (
    <div className="flex h-full">
      <Sidebar role={user.role} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          pageTitle={activeItem?.label ?? "Dashboard"}
          user={user}
          notifications={notifications}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-y-auto bg-sand-50 p-4 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
