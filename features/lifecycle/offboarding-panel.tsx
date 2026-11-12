"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { LogOut, CheckCircle2, Circle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label, Select, Input, Textarea, FieldGroup } from "@/components/ui/field";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import {
  startOffboarding,
  completeOffboarding,
  submitOffboardingForApproval,
  approveOffboarding,
  rejectOffboarding,
} from "./actions";
import {
  OFFBOARDING_REASONS,
  OFFBOARDING_REASON_LABELS,
  type OffboardingReasonValue,
} from "./schemas";
import type { OffboardingChecklist } from "./queries";

type OffboardingRecord = {
  reason: OffboardingReasonValue;
  lastWorkingDate: Date | null;
  startedAt: Date;
  completedAt: Date | null;
  notes: string | null;
  startedBy: { id: string; name: string } | null;
  completedBy: { id: string; name: string } | null;
  // Approval fields
  approvalStatus: string; // "PENDING" | "SUBMITTED" | "APPROVED" | "REJECTED"
  submittedAt: Date | null;
  submittedBy: { id: string; name: string } | null;
  approvedAt: Date | null;
  approvedBy: { id: string; name: string } | null;
  rejectedAt: Date | null;
  rejectedBy: { id: string; name: string } | null;
  rejectionReason: string | null;
} | null;

type Props = {
  employeeId: string;
  employmentStatus: string;
  checklist: OffboardingChecklist;
  record: OffboardingRecord;
  canManage: boolean;
  canApprove: boolean;
  cancelAction: () => Promise<unknown>;
};

export function OffboardingPanel({
  employeeId,
  employmentStatus: _employmentStatus,
  checklist,
  record,
  canManage,
  canApprove,
  cancelAction,
}: Props) {
  const [showStartForm, setShowStartForm] = useState(false);
  const t = useTranslations("lifecycle.offboarding");
  const tC = useTranslations("common");

  const startBound    = startOffboarding.bind(null, employeeId);
  const completeBound = completeOffboarding.bind(null, employeeId);
  const submitBound   = submitOffboardingForApproval.bind(null, employeeId);
  const approveBound  = approveOffboarding.bind(null, employeeId);
  const rejectBound   = rejectOffboarding.bind(null, employeeId);

  const [startState,    startAction,    startPending]    = useActionState<unknown, FormData>(startBound, null);
  const [completeState, completeAction]                  = useActionState<unknown, FormData>(completeBound, null);
  const [submitState,   submitAction,   submitPending]   = useActionState<unknown, FormData>(
    submitBound as (state: unknown, formData: FormData) => Promise<unknown>,
    null
  );
  const [approveState,  approveAction,  approvePending]  = useActionState<unknown, FormData>(
    approveBound as (state: unknown, formData: FormData) => Promise<unknown>,
    null
  );
  const [rejectState,   rejectAction,   rejectPending]   = useActionState<unknown, FormData>(rejectBound, null);

  const startError =
    startState && (startState as { success: boolean }).success === false
      ? (startState as { error: { message: string } }).error.message : null;

  const completeError =
    completeState && (completeState as { success: boolean }).success === false
      ? (completeState as { error: { message: string } }).error.message : null;

  const submitError =
    submitState && (submitState as { success: boolean }).success === false
      ? (submitState as { error: { message: string } }).error.message : null;

  const approveError =
    approveState && (approveState as { success: boolean }).success === false
      ? (approveState as { error: { message: string } }).error.message : null;

  const rejectError =
    rejectState && (rejectState as { success: boolean }).success === false
      ? (rejectState as { error: { message: string } }).error.message : null;

  const hasRecord    = !!record;
  const isInProgress = hasRecord && !record!.completedAt;
  const isCompleted  = hasRecord && !!record!.completedAt;

  // Checklist item labels
  const CHECKLIST_LABELS: Record<keyof Omit<OffboardingChecklist, "completedSteps" | "totalSteps" | "isComplete">, string> = {
    hasTerminatedContract:  t("reason"),
    hasNoActiveLeave:       t("notes"),
    userAccountDeactivated: t("completedAt"),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LogOut className="h-4 w-4 text-ink-900/60" />
          <span className="text-sm font-semibold text-ink-900">{t("title")}</span>
        </div>
        {isCompleted ? (
          <Badge tone="neutral">{t("completed")}</Badge>
        ) : isInProgress ? (
          <Badge tone="warning">{t("inProgress")}</Badge>
        ) : (
          <Badge tone="neutral">{tC("none")}</Badge>
        )}
      </div>

      {record && (
        <div className="rounded-xl border border-ink-900/8 bg-sand-50 p-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-ink-900/45">{t("reason")}</p>
              <p className="mt-0.5 text-ink-900">{OFFBOARDING_REASON_LABELS[record.reason]}</p>
            </div>
            {record.lastWorkingDate && (
              <div>
                <p className="text-xs font-medium text-ink-900/45">{t("lastWorkingDate")}</p>
                <p className="mt-0.5 text-ink-900">{record.lastWorkingDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
              </div>
            )}
            {record.startedBy && (
              <div>
                <p className="text-xs font-medium text-ink-900/45">{t("startedAt")}</p>
                <p className="mt-0.5 text-ink-900">{record.startedBy.name}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-medium text-ink-900/45">{t("startedAt")}</p>
              <p className="mt-0.5 text-ink-900">{record.startedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
            </div>
            {record.completedAt && record.completedBy && (
              <div className="col-span-2">
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

      {isInProgress && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-900/40">
            {checklist.completedSteps}/{checklist.totalSteps}
          </p>
          <div className="overflow-hidden rounded-xl border border-ink-900/8">
            {(Object.keys(CHECKLIST_LABELS) as Array<keyof typeof CHECKLIST_LABELS>).map((key, i, arr) => {
              const done = checklist[key] as boolean;
              return (
                <div key={key} className={["flex items-center gap-3 px-4 py-3", i < arr.length - 1 ? "border-b border-ink-900/6" : "", done ? "bg-white" : "bg-sand-50/60"].join(" ")}>
                  {done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <Circle className="h-4 w-4 shrink-0 text-ink-900/20" />}
                  <span className={`text-sm ${done ? "text-ink-900" : "text-ink-900/50"}`}>{CHECKLIST_LABELS[key]}</span>
                  {!done && <span className="ml-auto text-xs font-medium text-gold-600">{tC("loading")}</span>}
                </div>
              );
            })}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-900/8">
            <div className="h-full rounded-full bg-gold-400 transition-all duration-300" style={{ width: `${Math.round((checklist.completedSteps / checklist.totalSteps) * 100)}%` }} />
          </div>
        </div>
      )}

      {/* ── Start form (no record yet) ─────────────────────────────────── */}
      {canManage && !hasRecord && !showStartForm && (
        <Button variant="outline" size="md" onClick={() => setShowStartForm(true)} className="border-gold-400/30 text-gold-600 hover:bg-gold-400/5">
          <LogOut className="h-4 w-4" />
          {t("startOffboarding")}
        </Button>
      )}

      {canManage && !hasRecord && showStartForm && (
        <div className="rounded-xl border border-gold-400/30 bg-gold-400/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-gold-600" />
            <p className="text-sm font-semibold text-gold-700">{t("startOffboarding")}</p>
          </div>
          {startError && (
            <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{startError}</div>
          )}
          <form action={startAction} className="space-y-3">
            <FieldGroup>
              <Label htmlFor="ob-reason">{t("reason")} <span className="text-red-500">*</span></Label>
              <Select id="ob-reason" name="reason" required defaultValue="">
                <option value="" disabled>{t("selectReason")}</option>
                {OFFBOARDING_REASONS.map((r) => (
                  <option key={r} value={r}>{OFFBOARDING_REASON_LABELS[r]}</option>
                ))}
              </Select>
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="ob-lwd">{t("lastWorkingDate")}</Label>
              <Input id="ob-lwd" name="lastWorkingDate" type="date" />
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="ob-start-notes">{t("notes")} ({tC("optional")})</Label>
              <Textarea id="ob-start-notes" name="notes" rows={2} />
            </FieldGroup>
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={startPending} size="md">
                {startPending ? tC("loading") : t("startOffboarding")}
              </Button>
              <Button type="button" variant="ghost" size="md" onClick={() => setShowStartForm(false)}>
                {tC("cancel")}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ── Status-aware action sections (record in progress) ─────────── */}
      {isInProgress && (
        <div className="space-y-3">

          {/* PENDING: HR submits for approval */}
          {record!.approvalStatus === "PENDING" && canManage && (
            <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-4">
              <p className="mb-2 text-sm font-semibold text-brand-700">Ready to Submit</p>
              <p className="mb-3 text-xs text-ink-900/60">Complete the checklist above, then submit for GM approval.</p>
              {submitError && (
                <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{submitError}</div>
              )}
              <form action={submitAction}>
                <Button type="submit" disabled={submitPending || !checklist.isComplete} size="md">
                  {submitPending ? tC("loading") : "Submit for GM Approval"}
                </Button>
              </form>
            </div>
          )}

          {/* SUBMITTED: waiting for GM; GM sees approve/reject controls */}
          {record!.approvalStatus === "SUBMITTED" && (
            <div className="rounded-xl border border-gold-200 bg-gold-50/40 p-4">
              <p className="mb-2 text-sm font-semibold text-gold-700">Awaiting GM Approval</p>
              <p className="mb-1 text-xs text-ink-900/60">This offboarding request has been submitted and is awaiting General Manager review.</p>
              {record!.submittedAt && (
                <p className="text-xs text-ink-900/40">Submitted {record!.submittedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
              )}
              {canApprove && (
                <div className="mt-3 space-y-2">
                  {approveError && (
                    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{approveError}</div>
                  )}
                  <form action={approveAction} className="inline-block">
                    <Button type="submit" disabled={approvePending} size="md">
                      {approvePending ? tC("loading") : "Approve"}
                    </Button>
                  </form>
                  {rejectError && (
                    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{rejectError}</div>
                  )}
                  <form action={rejectAction} className="space-y-2">
                    <FieldGroup>
                      <Label htmlFor="ob-reject-reason">Rejection Reason <span className="text-red-500">*</span></Label>
                      <Textarea id="ob-reject-reason" name="rejectionReason" rows={2} required />
                    </FieldGroup>
                    <Button type="submit" variant="outline" disabled={rejectPending} size="md" className="border-red-300 text-red-600 hover:bg-red-50">
                      {rejectPending ? tC("loading") : "Reject"}
                    </Button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* APPROVED: HR completes */}
          {record!.approvalStatus === "APPROVED" && canManage && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
              <p className="mb-2 text-sm font-semibold text-emerald-700">Approved by GM</p>
              {record!.approvedBy && (
                <p className="mb-1 text-xs text-ink-900/60">Approved by {record!.approvedBy.name}</p>
              )}
              {completeError && (
                <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{completeError}</div>
              )}
              <form action={completeAction} className="mt-3 space-y-3">
                <FieldGroup>
                  <Label htmlFor="ob-complete-notes">{t("notes")} ({tC("optional")})</Label>
                  <Textarea id="ob-complete-notes" name="notes" rows={2} />
                </FieldGroup>
                <ConfirmSubmitButton
                  confirmTitle={t("completeOffboarding")}
                  confirmMessage={t("notes")}
                  confirmLabel={t("completeOffboarding")}
                  variant="danger"
                  size="md"
                  pendingLabel={t("completing")}
                >
                  {t("completeOffboarding")}
                </ConfirmSubmitButton>
              </form>
            </div>
          )}

          {/* REJECTED: HR revises and resubmits */}
          {record!.approvalStatus === "REJECTED" && canManage && (
            <div className="rounded-xl border border-red-200 bg-red-50/40 p-4">
              <p className="mb-2 text-sm font-semibold text-red-700">Rejected by GM</p>
              {record!.rejectionReason && (
                <p className="mb-1 text-sm text-ink-900/70">Reason: {record!.rejectionReason}</p>
              )}
              {record!.rejectedBy && (
                <p className="mb-3 text-xs text-ink-900/40">Rejected by {record!.rejectedBy.name}</p>
              )}
              {submitError && (
                <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{submitError}</div>
              )}
              <form action={submitAction}>
                <Button type="submit" disabled={submitPending || !checklist.isComplete} size="md">
                  {submitPending ? tC("loading") : "Resubmit for GM Approval"}
                </Button>
              </form>
            </div>
          )}

          {/* Cancel link — always visible for in-progress (any approval status) */}
          <div className="border-t border-ink-900/8 pt-3">
            <form action={cancelAction as unknown as (formData: FormData) => Promise<void>}>
              <button type="submit" className="text-sm font-medium text-ink-900/45 hover:text-ink-900">
                {t("cancelOffboarding")}
              </button>
            </form>
          </div>

        </div>
      )}
    </div>
  );
}
