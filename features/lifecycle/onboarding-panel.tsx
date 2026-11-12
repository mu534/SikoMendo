"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
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

export function OnboardingPanel({
  employeeId,
  employmentStatus,
  checklist,
  record,
  canManage,
}: Props) {
  const boundAction = completeOnboarding.bind(null, employeeId);
  const [state, formAction, isPending] = useActionState<unknown, FormData>(boundAction, null);
  const t = useTranslations("lifecycle.onboarding");
  const tC = useTranslations("common");

  const errorMessage =
    state && (state as { success: boolean }).success === false
      ? (state as { error: { message: string } }).error.message
      : null;

  const isOnboarding = employmentStatus === "ONBOARDING";
  const isCompleted  = !!record?.completedAt;

  // Checklist label keys map to lifecycle.onboarding namespace.
  // The contract row is only shown when the employee's employment type requires it.
  type ChecklistBooleanKey = keyof Omit<
    OnboardingChecklist,
    "contractRequired" | "completedSteps" | "totalSteps" | "isComplete"
  >;
  const CHECKLIST_KEYS: Array<{ key: ChecklistBooleanKey; label: string }> = [
    { key: "hasName",        label: t("checklistName") },
    { key: "hasDepartment",  label: t("checklistDepartment") },
    { key: "hasPosition",    label: t("checklistPosition") },
    { key: "hasHireDate",    label: t("checklistHireDate") },
    ...(checklist.contractRequired
      ? [{ key: "hasContract" as ChecklistBooleanKey, label: t("checklistContract") }]
      : []),
    { key: "hasIdDocument",  label: t("checklistIdDocument") },
    { key: "hasUserAccount", label: t("checklistUserAccount") },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-brand-700" />
          <span className="text-sm font-semibold text-ink-900">{t("title")}</span>
        </div>
        {isCompleted ? (
          <Badge tone="success">{t("completed")}</Badge>
        ) : isOnboarding ? (
          <Badge tone="brand">{t("inProgress")}</Badge>
        ) : (
          <Badge tone="neutral">{tC("none")}</Badge>
        )}
      </div>

      {record && (
        <div className="rounded-xl border border-ink-900/8 bg-sand-50 p-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-ink-900/45">{t("startedAt")}</p>
              <p className="mt-0.5 text-ink-900">{record.startedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
            </div>
            {record.completedAt && (
              <div>
                <p className="text-xs font-medium text-ink-900/45">{t("completedAt")}</p>
                <p className="mt-0.5 text-ink-900">{record.completedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
              </div>
            )}
            {record.responsibleHr && (
              <div>
                <p className="text-xs font-medium text-ink-900/45">{t("responsibleHr")}</p>
                <p className="mt-0.5 text-ink-900">{record.responsibleHr.name}</p>
              </div>
            )}
            {record.completedBy && (
              <div>
                <p className="text-xs font-medium text-ink-900/45">{t("completedAt")}</p>
                <p className="mt-0.5 text-ink-900">{record.completedBy.name}</p>
              </div>
            )}
          </div>
          {record.notes && (
            <div className="mt-3 border-t border-ink-900/8 pt-3">
              <p className="text-xs font-medium text-ink-900/45">{t("notes")}</p>
              <p className="mt-0.5 text-ink-900/70">{record.notes}</p>
            </div>
          )}
        </div>
      )}

      {(isOnboarding || record) && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-900/40">
            {t("checklistTitle")} — {checklist.completedSteps}/{checklist.totalSteps}
          </p>
          <div className="overflow-hidden rounded-xl border border-ink-900/8">
            {CHECKLIST_KEYS.map(({ key, label }, i) => {
              const done = checklist[key] as boolean;
              return (
                <div
                  key={key}
                  className={[
                    "flex items-center gap-3 px-4 py-3",
                    i < CHECKLIST_KEYS.length - 1 ? "border-b border-ink-900/6" : "",
                    done ? "bg-white" : "bg-sand-50/60",
                  ].join(" ")}
                >
                  {done ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-ink-900/20" />
                  )}
                  <span className={`text-sm ${done ? "text-ink-900" : "text-ink-900/50"}`}>
                    {label}
                  </span>
                  {!done && (
                    <span className="ml-auto text-xs font-medium text-gold-600">{tC("loading")}</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="h-1.5 overflow-hidden rounded-full bg-ink-900/8">
            <div
              className="h-full rounded-full bg-brand-700 transition-all duration-300"
              style={{ width: `${Math.round((checklist.completedSteps / checklist.totalSteps) * 100)}%` }}
            />
          </div>
          <p className="text-right text-xs text-ink-900/45">
            {Math.round((checklist.completedSteps / checklist.totalSteps) * 100)}%
          </p>
        </div>
      )}

      {canManage && isOnboarding && !isCompleted && (
        <div className="rounded-xl border border-brand-700/20 bg-brand-50/30 p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-brand-700" />
            <p className="text-sm font-semibold text-brand-800">{t("completeOnboarding")}</p>
          </div>

          {errorMessage && (
            <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <form action={formAction} className="space-y-3">
            <FieldGroup>
              <Label htmlFor="ob-notes">{t("notes")} ({tC("optional")})</Label>
              <Textarea id="ob-notes" name="notes" rows={2} placeholder={t("notes")} />
            </FieldGroup>
            <Button type="submit" disabled={isPending} size="md">
              {isPending ? t("completing") : t("completeOnboarding")}
            </Button>
          </form>
        </div>
      )}

      {!record && !isOnboarding && (
        <p className="text-sm text-ink-900/50">{t("noOnboarding")}</p>
      )}
    </div>
  );
}
