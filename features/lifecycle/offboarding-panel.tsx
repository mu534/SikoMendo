"use client";

import { useActionState, useState } from "react";
import { LogOut, CheckCircle2, Circle, AlertTriangle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label, Select, Input, Textarea, FieldGroup } from "@/components/ui/field";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import {
  startOffboarding,
  completeOffboarding,
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
} | null;

type Props = {
  employeeId: string;
  employmentStatus: string;
  checklist: OffboardingChecklist;
  record: OffboardingRecord;
  canManage: boolean;
  /** Bound cancel action passed from the server page to avoid "use server" inside a client component. */
  cancelAction: () => Promise<unknown>;
};

const OFFBOARDING_CHECKLIST_LABELS: Record<
  keyof Omit<OffboardingChecklist, "completedSteps" | "totalSteps" | "isComplete">,
  string
> = {
  hasTerminatedContract:  "Contract terminated or expired",
  hasNoActiveLeave:       "No pending leave requests",
  userAccountDeactivated: "System account deactivated",
};

export function OffboardingPanel({
  employeeId,
  employmentStatus: _employmentStatus,
  checklist,
  record,
  canManage,
  cancelAction,
}: Props) {
  const [showStartForm, setShowStartForm] = useState(false);

  const startBound    = startOffboarding.bind(null, employeeId);
  const completeBound = completeOffboarding.bind(null, employeeId);

  const [startState,    startAction,    startPending]    = useActionState<unknown, FormData>(startBound, null);
  const [completeState, completeAction] = useActionState<unknown, FormData>(completeBound, null);

  const startError =
    startState && (startState as { success: boolean }).success === false
      ? (startState as { error: { message: string } }).error.message
      : null;

  const completeError =
    completeState && (completeState as { success: boolean }).success === false
      ? (completeState as { error: { message: string } }).error.message
      : null;

  const hasRecord    = !!record;
  const isInProgress = hasRecord && !record!.completedAt;
  const isCompleted  = hasRecord && !!record!.completedAt;

  return (
    <div className="space-y-6">

      {/* ── Status bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LogOut className="h-4 w-4 text-ink-900/60" />
          <span className="text-sm font-semibold text-ink-900">Offboarding</span>
        </div>
        {isCompleted ? (
          <Badge tone="neutral">Completed</Badge>
        ) : isInProgress ? (
          <Badge tone="warning">In Progress</Badge>
        ) : (
          <Badge tone="neutral">Not initiated</Badge>
        )}
      </div>

      {/* ── Record metadata ────────────────────────────────────────────── */}
      {record && (
        <div className="rounded-xl border border-ink-900/8 bg-sand-50 p-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-ink-900/45">Reason</p>
              <p className="mt-0.5 text-ink-900">{OFFBOARDING_REASON_LABELS[record.reason]}</p>
            </div>
            {record.lastWorkingDate && (
              <div>
                <p className="text-xs font-medium text-ink-900/45">Last working day</p>
                <p className="mt-0.5 text-ink-900">
                  {record.lastWorkingDate.toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            )}
            {record.startedBy && (
              <div>
                <p className="text-xs font-medium text-ink-900/45">Initiated by</p>
                <p className="mt-0.5 text-ink-900">{record.startedBy.name}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-medium text-ink-900/45">Started</p>
              <p className="mt-0.5 text-ink-900">
                {record.startedAt.toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
            {record.completedAt && record.completedBy && (
              <div className="col-span-2">
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

      {/* ── Checklist ──────────────────────────────────────────────────── */}
      {isInProgress && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-900/40">
            Checklist — {checklist.completedSteps}/{checklist.totalSteps} complete
          </p>
          <div className="overflow-hidden rounded-xl border border-ink-900/8">
            {(
              Object.keys(OFFBOARDING_CHECKLIST_LABELS) as Array<
                keyof typeof OFFBOARDING_CHECKLIST_LABELS
              >
            ).map((key, i, arr) => {
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
                    {OFFBOARDING_CHECKLIST_LABELS[key]}
                  </span>
                  {!done && (
                    <span className="ml-auto text-xs font-medium text-gold-600">Pending</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-900/8">
            <div
              className="h-full rounded-full bg-gold-400 transition-all duration-300"
              style={{
                width: `${Math.round(
                  (checklist.completedSteps / checklist.totalSteps) * 100
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* ── Actions ────────────────────────────────────────────────────── */}
      {canManage && (
        <div className="space-y-3">

          {/* Initiate offboarding button */}
          {!hasRecord && !showStartForm && (
            <Button
              variant="outline"
              size="md"
              onClick={() => setShowStartForm(true)}
              className="border-gold-400/30 text-gold-600 hover:bg-gold-400/5"
            >
              <LogOut className="h-4 w-4" />
              Initiate offboarding
            </Button>
          )}

          {/* Start offboarding form */}
          {!hasRecord && showStartForm && (
            <div className="rounded-xl border border-gold-400/30 bg-gold-400/5 p-4">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-gold-600" />
                <p className="text-sm font-semibold text-gold-700">Initiate offboarding</p>
              </div>

              {startError && (
                <div
                  role="alert"
                  className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
                >
                  {startError}
                </div>
              )}

              <form action={startAction} className="space-y-3">
                <FieldGroup>
                  <Label htmlFor="ob-reason">
                    Reason <span className="text-red-500">*</span>
                  </Label>
                  <Select id="ob-reason" name="reason" required defaultValue="">
                    <option value="" disabled>
                      Select reason…
                    </option>
                    {OFFBOARDING_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {OFFBOARDING_REASON_LABELS[r]}
                      </option>
                    ))}
                  </Select>
                </FieldGroup>
                <FieldGroup>
                  <Label htmlFor="ob-lwd">Last working date</Label>
                  <Input id="ob-lwd" name="lastWorkingDate" type="date" />
                </FieldGroup>
                <FieldGroup>
                  <Label htmlFor="ob-start-notes">Notes (optional)</Label>
                  <Textarea id="ob-start-notes" name="notes" rows={2} />
                </FieldGroup>
                <div className="flex items-center gap-2">
                  <Button type="submit" disabled={startPending} size="md">
                    {startPending ? "Starting…" : "Start offboarding"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    onClick={() => setShowStartForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Complete offboarding */}
          {isInProgress && (
            <div className="rounded-xl border border-red-200 bg-red-50/40 p-4">
              <div className="mb-3 flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <p className="text-sm font-semibold text-red-700">Complete offboarding</p>
              </div>
              <p className="mb-3 text-xs text-ink-900/60">
                This will <strong>archive the employee</strong> and deactivate their system
                account. This cannot be undone through the normal HR workflow.
              </p>

              {completeError && (
                <div
                  role="alert"
                  className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
                >
                  {completeError}
                </div>
              )}

              <form action={completeAction} className="space-y-3">
                <FieldGroup>
                  <Label htmlFor="ob-complete-notes">Final notes (optional)</Label>
                  <Textarea id="ob-complete-notes" name="notes" rows={2} />
                </FieldGroup>
                <ConfirmSubmitButton
                  confirmTitle="Complete offboarding?"
                  confirmMessage="The employee will be archived and their system account deactivated. An Administrator can restore the employee if needed."
                  confirmLabel="Complete offboarding"
                  variant="danger"
                  size="md"
                  pendingLabel="Completing…"
                >
                  Complete offboarding
                </ConfirmSubmitButton>
              </form>

              {/* Cancel offboarding — uses the bound server action passed as a prop */}
              <div className="mt-3 border-t border-ink-900/8 pt-3">
                <form action={cancelAction as unknown as (formData: FormData) => Promise<void>}>
                  <button
                    type="submit"
                    className="text-sm font-medium text-ink-900/45 hover:text-ink-900"
                  >
                    Cancel offboarding
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
