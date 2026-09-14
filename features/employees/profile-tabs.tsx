"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { User, Briefcase, Clock, Calendar, FileText, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProfileTab =
  | "overview"
  | "employment"
  | "attendance"
  | "leave"
  | "documents"
  | "lifecycle";

const ALL_TABS: {
  id: ProfileTab;
  label: string;
  icon: React.ElementType;
}[] = [
  { id: "overview",    label: "Overview",    icon: User       },
  { id: "employment",  label: "Employment",  icon: Briefcase  },
  { id: "attendance",  label: "Attendance",  icon: Clock      },
  { id: "leave",       label: "Leave",       icon: Calendar   },
  { id: "documents",   label: "Documents",   icon: FileText   },
  { id: "lifecycle",   label: "Lifecycle",   icon: Activity   },
];

export function ProfileTabs({
  employeeId,
  visibleTabs,
}: {
  employeeId: string;
  visibleTabs?: ProfileTab[];
}) {
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get("tab") ?? "overview") as ProfileTab;

  const tabs = visibleTabs
    ? ALL_TABS.filter((t) => visibleTabs.includes(t.id))
    : ALL_TABS;

  return (
    <div className="border-b border-ink-900/8 bg-white">
      <nav
        className="-mb-px flex overflow-x-auto px-4 sm:px-6"
        aria-label="Employee profile sections"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const href =
            tab.id === "overview"
              ? `/employees/${employeeId}`
              : `/employees/${employeeId}?tab=${tab.id}`;
          const Icon = tab.icon;

          return (
            <Link
              key={tab.id}
              href={href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3.5 text-sm font-medium transition-colors sm:px-4",
                isActive
                  ? "border-brand-700 text-brand-700"
                  : "border-transparent text-ink-900/50 hover:border-ink-900/20 hover:text-ink-900"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.slice(0, 4)}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
