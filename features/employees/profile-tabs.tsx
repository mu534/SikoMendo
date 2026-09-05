"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export type ProfileTab = "overview" | "history" | "contracts" | "documents";

const TABS: { id: ProfileTab; label: string }[] = [
  { id: "overview",   label: "Overview" },
  { id: "history",    label: "Employment History" },
  { id: "contracts",  label: "Contracts" },
  { id: "documents",  label: "Documents" },
];

export function ProfileTabs({ employeeId }: { employeeId: string }) {
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get("tab") ?? "overview") as ProfileTab;

  return (
    <div className="border-b border-ink-900/8 bg-white">
      <nav
        className="-mb-px flex overflow-x-auto px-6"
        aria-label="Employee profile sections"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const href =
            tab.id === "overview"
              ? `/employees/${employeeId}`
              : `/employees/${employeeId}?tab=${tab.id}`;

          return (
            <Link
              key={tab.id}
              href={href}
              className={cn(
                "flex shrink-0 items-center border-b-2 px-4 py-3.5 text-sm font-medium transition-colors",
                isActive
                  ? "border-brand-700 text-brand-700"
                  : "border-transparent text-ink-900/55 hover:border-ink-900/20 hover:text-ink-900"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
