"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Menu, LogOut, ChevronDown, Bell } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { roleLabel } from "@/lib/permissions";
import { markNotificationRead, markAllNotificationsRead } from "@/features/notifications/actions";
import { formatDateTime } from "@/lib/utils";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
};

export function Header({
  pageTitle,
  user,
  notifications,
  onMenuClick,
}: {
  pageTitle: string;
  user: { name: string; email: string; role: string; image?: string | null };
  notifications: { items: NotificationItem[]; unreadCount: number };
  onMenuClick: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSignOut() {
    startTransition(async () => {
      await authClient.signOut();
      router.push("/sign-in");
      router.refresh();
    });
  }

  function handleNotificationClick(notification: NotificationItem) {
    if (!notification.isRead) {
      startTransition(async () => {
        await markNotificationRead(notification.id);
        router.refresh();
      });
    }
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  }

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-ink-900/8 bg-white px-4 py-3.5 sm:px-8">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-ink-900/60 hover:bg-sand-100 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="font-display text-lg font-semibold text-ink-900">{pageTitle}</h1>
      </div>

      <div className="flex items-center gap-1.5">
        <div className="relative">
          <button
            onClick={() => setNotifOpen((open) => !open)}
            className="relative rounded-lg p-2 text-ink-900/60 hover:bg-sand-100"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {notifications.unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-semibold text-white">
                {notifications.unreadCount > 9 ? "9+" : notifications.unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <>
              <button aria-label="Close notifications" className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-ink-900/8 bg-white py-2 shadow-lg shadow-ink-900/5">
                <div className="flex items-center justify-between border-b border-ink-900/8 px-3.5 pb-2.5">
                  <p className="text-sm font-medium text-ink-900">Notifications</p>
                  {notifications.unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      disabled={isPending}
                      className="text-xs font-medium text-brand-700 hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.items.length === 0 ? (
                    <p className="px-3.5 py-6 text-center text-sm text-ink-900/40">No notifications yet.</p>
                  ) : (
                    notifications.items.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`block w-full px-3.5 py-2.5 text-left hover:bg-sand-100 ${n.isRead ? "" : "bg-brand-50/50"}`}
                      >
                        <p className="text-sm font-medium text-ink-900">{n.title}</p>
                        <p className="mt-0.5 text-xs text-ink-900/60">{n.message}</p>
                        <p className="mt-1 text-[11px] text-ink-900/35">{formatDateTime(n.createdAt)}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="relative">
        <button
          onClick={() => setMenuOpen((open) => !open)}
          className="flex items-center gap-2.5 rounded-lg py-1.5 pl-1.5 pr-2.5 hover:bg-sand-100"
        >
          <Avatar name={user.name} imageUrl={user.image} size="sm" />
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-medium text-ink-900">{user.name}</span>
            <span className="block text-xs text-ink-900/50">{roleLabel(user.role)}</span>
          </span>
          <ChevronDown className="h-4 w-4 text-ink-900/40" />
        </button>

        {menuOpen && (
          <>
            <button
              aria-label="Close menu"
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-ink-900/8 bg-white py-2 shadow-lg shadow-ink-900/5">
              <div className="border-b border-ink-900/8 px-3.5 pb-2.5">
                <p className="truncate text-sm font-medium text-ink-900">{user.name}</p>
                <p className="truncate text-xs text-ink-900/50">{user.email}</p>
                <Badge tone="brand" className="mt-2">
                  {roleLabel(user.role)}
                </Badge>
              </div>
              <a href="/profile" className="block px-3.5 py-2 text-sm text-ink-900/80 hover:bg-sand-100">
                My profile
              </a>
              <button
                onClick={handleSignOut}
                disabled={isPending}
                className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                {isPending ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </>
        )}
      </div>
      </div>
    </header>
  );
}
