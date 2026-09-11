"use client";

import { useActionState } from "react";
import { CheckCircle2, Circle, AlertCircle, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label, Textarea, FieldGroup } from "@/components/ui/field";
import { completeOnboarding } from "./actions";
import type { OnboardingChecklist } from "./queries";

type OnboardingRecord = {
  startedAt: Date;
  completedAt: Date | null;
  notes: string | null;
  responsibleHr: { id: string; name: string } | null;
  completedBy: { id: string; name: string } | null;
} | null;

type Props = {
  employeeId: string;
  employmentStatus: string;
  checklist: OnboardingChecklist;
  record: OnboardingRecord;
  canManage: boolean;
};

const CHECKLIST_LABELS: Record<keyof Omit<OnboardingChecklist, "completedSteps" | "totalSteps" | "isComplete">, string> = {
  hasName:        "Employee name recorded",
  hasDepartment:  "Department assigned",
  hasPosition:    "Position assigned",
  hasHireDate:    "Hire date set",
  hasContract:    "Active contract created",
  hasIdDocument:  "ID document uploaded",
  hasUserAccount: "System account created",
};

export function OnboardingPanel({
  employeeId,
  employmentStatus,
  checklist,
  record,
  canManage,
}: Props) {
  const boundAction = completeOnboarding.bind(null, employeeId);
  const [state, formAction, isPending] = useActionState<unknown, FormData>(
    boundAction,
    null
  );

  const errorMessage =
    state && (state as { success: boolean }).success === false
      ? (state as { error: { message: string } }).error.message
      : null;

  const isOnboarding = employmentStatus === "ONBOARDING";
  const isCompleted  = !!record?.completedAt;

  return (
    <div className="space-y-6">
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-brand-700" />
          <span className="text-sm font-semibold text-ink-900">Onboarding</span>
        </div>
        {isCompleted ? (
          <Badge tone="success">Completed</Badge>
        ) : isOnboarding ? (
          <Badge tone="brand">In Progress</Badge>
        ) : (
          <Badge tone="neutral">Not Started</Badge>
        )}
      </div>

      {/* Record metadata */}
      {record && (
        <div className="rounded-xl border border-ink-900/8 bg-sand-50 p-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-ink-900/45">Started</p>
              <p className="mt-0.5 text-ink-900">{record.startedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
            </div>
            {record.completedAt && (
              <div>
                <p className="text-xs font-medium text-ink-900/45">Completed</p>
                <p className="mt-0.5 text-ink-900">{record.completedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
              </div>
            )}
            {record.responsibleHr && (
              <div>
                <p className="text-xs font-medium text-ink-900/45">Responsible HR</p>
                <p className="mt-0.5 text-ink-900">{record.responsibleHr.name}</p>
              </div>
            )}
            {record.completedBy && (
              <div>
                <p className="text-xs font-medium text-ink-900/45">Completed by</p>
                <p className="mt-0.5 text-ink-900">{record.completedBy.name}</p>
              </div>
            )}
          </div>
          {record.notes && (
            <div className="mt-3 border-t border-ink-900/8 pt-3">
              <p className="text-xs font-medium text-ink-900/45">Notes</p>
              <p className="mt-0.5 text-ink-900/70">{record.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Checklist */}
      {(isOnboarding || record) && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-900/40">
            Checklist — {checklist.completedSteps}/{checklist.totalSteps} complete
          </p>
          <div className="overflow-hidden rounded-xl border border-ink-900/8">
            {(Object.keys(CHECKLIST_LABELS) as Array<keyof typeof CHECKLIST_LABELS>).map((key, i, arr) => {
              const done = checklist[key] as boolean;
              return (
                <div
                  key={key}
                  className={[
                    "flex items-center gap-3 px-4 py-3",
                    i < arr.length - 1 ? "border-b border-ink-900/6" : "",
                    done ? "bg-white" : "bg-sand-50/60",
                  ].join(" ")}
                >
                  {done ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-ink-900/20" />
                  )}
                  <span className={`text-sm ${done ? "text-ink-900" : "text-ink-900/50"}`}>
                    {CHECKLIST_LABELS[key]}
                  </span>
                  {!done && (
                    <span className="ml-auto text-xs font-medium text-gold-600">Pending</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-900/8">
            <div
              className="h-full rounded-full bg-brand-700 transition-all duration-300"
              style={{ width: `${Math.round((checklist.completedSteps / checklist.totalSteps) * 100)}%` }}
            />
          </div>
          <p className="text-right text-xs text-ink-900/45">
            {Math.round((checklist.completedSteps / checklist.totalSteps) * 100)}% complete
          </p>
        </div>
      )}

      {/* Complete onboarding form — only shown to HR while onboarding is in progress */}
      {canManage && isOnboarding && !isCompleted && (
        <div className="rounded-xl border border-brand-700/20 bg-brand-50/30 p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-brand-700" />
            <p className="text-sm font-semibold text-brand-800">Complete onboarding</p>
          </div>
          <p className="mb-4 text-xs text-ink-900/60">
            Verify the checklist above before completing. This will transition the employee to{" "}
            <strong>Active</strong> status.
          </p>

          {errorMessage && (
            <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <form action={formAction} className="space-y-3">
            <FieldGroup>
              <Label htmlFor="ob-notes">Notes (optional)</Label>
              <Textarea
                id="ob-notes"
                name="notes"
                rows={2}
                placeholder="Any remarks about the onboarding process…"
              />
            </FieldGroup>
            <Button type="submit" disabled={isPending} size="md">
              {isPending ? "Completing…" : "Mark onboarding complete"}
            </Button>
          </form>
        </div>
      )}

      {/* No onboarding record and not in onboarding state */}
      {!record && !isOnboarding && (
        <p className="text-sm text-ink-900/50">
          No onboarding record for this employee. Onboarding is automatically initiated when a new
          employee is created.
        </p>
      )}
    </div>
  );
}
