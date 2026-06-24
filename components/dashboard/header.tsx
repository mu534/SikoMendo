"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Menu, LogOut, ChevronDown } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { roleLabel } from "@/lib/permissions";

export function Header({
  pageTitle,
  user,
  onMenuClick,
}: {
  pageTitle: string;
  user: { name: string; email: string; role: string; image?: string | null };
  onMenuClick: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSignOut() {
    startTransition(async () => {
      await authClient.signOut();
      router.push("/sign-in");
      router.refresh();
    });
  }

  return (
    <header className="flex items-center justify-between gap-4 border-b border-ink-900/8 bg-white px-4 py-3.5 sm:px-8">
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
    </header>
  );
}
