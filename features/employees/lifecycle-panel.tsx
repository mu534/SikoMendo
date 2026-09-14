import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight, UserPlus, LogOut, Briefcase } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { OnboardingPanel } from "@/features/lifecycle/onboarding-panel";
import { OffboardingPanel } from "@/features/lifecycle/offboarding-panel";
import type { OnboardingChecklist, OffboardingChecklist } from "@/features/lifecycle/queries";
import type { OffboardingReasonValue } from "@/features/lifecycle/schemas";

type OnboardingRecord = {
  startedAt: Date;
  completedAt: Date | null;
  notes: string | null;
  responsibleHr: { id: string; name: string } | null;
  completedBy: { id: string; name: string } | null;
} | null;

type OffboardingRecord = {
  reason: OffboardingReasonValue;
  lastWorkingDate: Date | null;
  startedAt: Date;
  completedAt: Date | null;
  notes: string | null;
  startedBy: { id: string; name: string } | null;
  completedBy: { id: string; name: string } | null;
} | null;

type HistoryRow = {
  id: string;
  department: { name: string };
  position: { name: string };
  employmentType: string | null;
  effectiveDate: Date;
  endDate: Date | null;
  changeReason: string;
  remarks: string | null;
};

const OFFBOARDING_REASON_LABEL: Record<string, string> = {
  RESIGNATION:  "Resignation",
  RETIREMENT:   "Retirement",
  CONTRACT_END: "Contract End",
  TERMINATION:  "Termination",
  OTHER:        "Other",
};

// Actionable links per missing checklist item
const CHECKLIST_ACTIONS: Record<string, { label: string; tabParam: string } | null> = {
  hasName:        null,
  hasDepartment:  { label: "Edit employee",          tabParam: "overview"    },
  hasPosition:    { label: "Edit employee",          tabParam: "overview"    },
  hasHireDate:    { label: "Edit employee",          tabParam: "overview"    },
  hasContract:    { label: "Add contract",           tabParam: "employment"  },
  hasIdDocument:  { label: "Upload ID document",     tabParam: "documents"   },
  hasUserAccount: { label: "Create system account",  tabParam: "overview"    },
};

const CHECKLIST_LABELS: Record<string, string> = {
  hasName:        "Employee name recorded",
  hasDepartment:  "Department assigned",
  hasPosition:    "Position assigned",
  hasHireDate:    "Hire date set",
  hasContract:    "Active contract created",
  hasIdDocument:  "ID document uploaded",
  hasUserAccount: "System account created",
};

function OnboardingProgressCard({
  employeeId,
  checklist,
  canManage,
}: {
  employeeId: string;
  checklist: OnboardingChecklist;
  canManage: boolean;
}) {
  const pct = Math.round((checklist.completedSteps / checklist.totalSteps) * 100);

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-brand-700" aria-hidden="true" />
          <h3 className="font-display text-sm font-semibold text-ink-900">Onboarding Progress</h3>
        </div>
        <span className="text-sm font-semibold text-brand-700">{pct}%</span>
      </div>

      {/* Progress bar */}
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-ink-900/8">
        <div
          className="h-full rounded-full bg-brand-700 transition-all duration-300"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Onboarding ${pct}% complete`}
        />
      </div>
      <p className="mb-4 text-xs text-ink-900/50">
        {checklist.completedSteps} of {checklist.totalSteps} requirements complete
      </p>

      {/* Checklist rows */}
      <ul className="space-y-1.5">
        {(Object.keys(CHECKLIST_LABELS) as string[]).map((key) => {
          const done = checklist[key as keyof OnboardingChecklist] as boolean;
          const action = CHECKLIST_ACTIONS[key];

          return (
            <li key={key} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {done ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-ink-900/20" aria-hidden="true" />
                )}
                <span className={`text-sm ${done ? "text-ink-900/70" : "text-ink-900/50"}`}>
                  {CHECKLIST_LABELS[key]}
                </span>
              </div>
              {!done && canManage && action && (
                <Link
                  href={`/employees/${employeeId}?tab=${action.tabParam}`}
                  className="flex shrink-0 items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                >
                  {action.label}
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function LifecycleTimeline({
  employmentHistory,
  onboardingRecord,
  offboardingRecord,
  hireDate,
}: {
  employmentHistory: HistoryRow[];
  onboardingRecord: OnboardingRecord;
  offboardingRecord: OffboardingRecord;
  hireDate: Date | null;
}) {
  type TimelineEvent = {
    date: Date;
    title: string;
    detail: string;
    icon: React.ElementType;
    tone: "success" | "brand" | "warning" | "danger" | "neutral";
  };

  const events: TimelineEvent[] = [];

  // Hire event from first history or hireDate
  const firstHistory = [...employmentHistory].sort(
    (a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime()
  )[0];
  const hireDateValue = firstHistory?.effectiveDate ?? hireDate;
  if (hireDateValue) {
    events.push({
      date: hireDateValue,
      title: "Employee hired",
      detail: [
        firstHistory?.department?.name,
        firstHistory?.position?.name,
        firstHistory?.employmentType,
      ]
        .filter(Boolean)
        .join(" · ") || "Initial hire",
      icon: UserPlus,
      tone: "success",
    });
  }

  // Onboarding completed
  if (onboardingRecord?.completedAt) {
    events.push({
      date: onboardingRecord.completedAt,
      title: "Onboarding completed",
      detail: onboardingRecord.completedBy
        ? `By ${onboardingRecord.completedBy.name}`
        : "Onboarding checklist completed",
      icon: CheckCircle2,
      tone: "brand",
    });
  }

  // Employment changes (skip the first/initial hire row)
  const changes = [...employmentHistory]
    .sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime())
    .slice(1);

  for (const change of changes) {
    events.push({
      date: change.effectiveDate,
      title: `Employment change`,
      detail: [change.department.name, change.position.name, change.changeReason]
        .filter(Boolean)
        .join(" · "),
      icon: Briefcase,
      tone: "neutral",
    });
  }

  // Offboarding
  if (offboardingRecord?.completedAt) {
    events.push({
      date: offboardingRecord.completedAt,
      title: `Offboarding completed — ${OFFBOARDING_REASON_LABEL[offboardingRecord.reason] ?? offboardingRecord.reason}`,
      detail: offboardingRecord.lastWorkingDate
        ? `Last working day: ${formatDate(offboardingRecord.lastWorkingDate)}`
        : "Archived",
      icon: LogOut,
      tone: "danger",
    });
  } else if (offboardingRecord && !offboardingRecord.completedAt) {
    events.push({
      date: offboardingRecord.startedAt,
      title: `Offboarding initiated — ${OFFBOARDING_REASON_LABEL[offboardingRecord.reason] ?? offboardingRecord.reason}`,
      detail: offboardingRecord.lastWorkingDate
        ? `Last working day: ${formatDate(offboardingRecord.lastWorkingDate)}`
        : "In progress",
      icon: LogOut,
      tone: "warning",
    });
  }

  // Sort newest first
  events.sort((a, b) => b.date.getTime() - a.date.getTime());

  if (events.length === 0) return null;

  const toneBg: Record<string, string> = {
    success: "bg-emerald-50 text-emerald-600",
    brand:   "bg-brand-50 text-brand-600",
    warning: "bg-gold-50 text-gold-600",
    danger:  "bg-red-50 text-red-500",
    neutral: "bg-ink-900/5 text-ink-900/50",
  };

  return (
    <Card>
      <CardHeader title="Lifecycle Timeline" />
      <ul className="px-5 py-4">
        {events.map((ev, i) => {
          const Icon = ev.icon;
          const isLast = i === events.length - 1;
          return (
            <li key={i} className="flex gap-3">
              {/* Timeline spine */}
              <div className="flex flex-col items-center">
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${toneBg[ev.tone]}`}>
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
                {!isLast && (
                  <div className="w-px flex-1 bg-ink-900/8 my-1" aria-hidden="true" />
                )}
              </div>

              {/* Content */}
              <div className={`pb-5 min-w-0 ${isLast ? "" : ""}`}>
                <p className="text-xs font-medium text-ink-900/40">{formatDate(ev.date)}</p>
                <p className="mt-0.5 text-sm font-medium text-ink-900">{ev.title}</p>
                {ev.detail && (
                  <p className="mt-0.5 text-xs text-ink-900/55">{ev.detail}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function LifecyclePanel({
  employeeId,
  employmentStatus,
  checklist,
  offboardingChecklist,
  onboardingRecord,
  offboardingRecord,
  canManage,
  canManageOnboarding,
  canManageOffboarding,
  cancelOffboardingAction,
  employmentHistory,
  hireDate,
}: {
  employeeId: string;
  employmentStatus: string;
  checklist: OnboardingChecklist;
  offboardingChecklist: OffboardingChecklist;
  onboardingRecord: OnboardingRecord;
  offboardingRecord: OffboardingRecord;
  canManage: boolean;
  canManageOnboarding: boolean;
  canManageOffboarding: boolean;
  cancelOffboardingAction: () => Promise<unknown>;
  employmentHistory: HistoryRow[];
  hireDate: Date | null;
}) {
  const isOnboarding = employmentStatus === "ONBOARDING";
  const isOffboarding =
    offboardingRecord !== null && !offboardingRecord.completedAt;

  return (
    <div className="space-y-5">
      {/* Onboarding progress compact card — shown while in onboarding */}
      {isOnboarding && (
        <OnboardingProgressCard
          employeeId={employeeId}
          checklist={checklist}
          canManage={canManage}
        />
      )}

      {/* Full onboarding + offboarding panels */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Onboarding"
            description="Pre-boarding checklist and activation."
          />
          <div className="p-5">
            <OnboardingPanel
              employeeId={employeeId}
              employmentStatus={employmentStatus}
              checklist={checklist}
              record={onboardingRecord}
              canManage={canManageOnboarding}
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Offboarding"
            description="Departure workflow and archiving."
          />
          <div className="p-5">
            <OffboardingPanel
              employeeId={employeeId}
              employmentStatus={employmentStatus}
              checklist={offboardingChecklist}
              record={offboardingRecord}
              canManage={canManageOffboarding}
              cancelAction={cancelOffboardingAction}
            />
          </div>
        </Card>
      </div>

      {/* Timeline */}
      <LifecycleTimeline
        employmentHistory={employmentHistory}
        onboardingRecord={onboardingRecord}
        offboardingRecord={offboardingRecord}
        hireDate={hireDate}
      />
    </div>
  );
}
