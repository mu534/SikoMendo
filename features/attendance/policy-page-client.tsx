"use client";

/**
 * Client wrapper for the Attendance Policy page.
 *
 * Owns the "current unsaved rules" state so the live preview updates
 * immediately as the admin/HR officer changes form values — without any
 * server round-trips.
 *
 * Layout:
 *   Left (~60%)  : Work Shifts manager + Attendance rules form
 *   Right (~40%) : Read-only overview + live policy preview
 */

import { useState } from "react";
import { Shield } from "lucide-react";
import { ShiftsManager } from "./shifts-manager";
import { AttendanceRulesForm, type RulesFormValues } from "./attendance-rules-form";
import { PolicyPreview } from "./policy-preview";
import type { ShiftRow } from "./shift-queries";

const DAY_LABELS: Record<number, string> = {
  1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat", 7: "Sun",
};

function fmtTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = (h ?? 0) >= 12 ? "PM" : "AM";
  const h12    = (h ?? 0) % 12 || 12;
  return `${h12}:${String(m ?? 0).padStart(2, "0")} ${period}`;
}

type PolicyRow = {
  morningStartTime:         string;
  morningCheckInDeadline:   string;
  afternoonStartTime:       string;
  afternoonCheckInDeadline: string;
  graceMinutes:             number;
  workingDays:              string;
} | null;

function parseWorkingDays(raw: string | null | undefined): number[] {
  try {
    const parsed = JSON.parse(raw ?? "[1,2,3,4,5]");
    return Array.isArray(parsed) ? parsed : [1, 2, 3, 4, 5];
  } catch {
    return [1, 2, 3, 4, 5];
  }
}

type Props = {
  policy: PolicyRow;
  allShifts: ShiftRow[];
  activeShifts: ShiftRow[];
};

export function PolicyPageClient({ policy, allShifts, activeShifts }: Props) {
  const savedRules: RulesFormValues = {
    morningStartTime:         policy?.morningStartTime         ?? "08:00",
    morningCheckInDeadline:   policy?.morningCheckInDeadline   ?? "08:15",
    afternoonStartTime:       policy?.afternoonStartTime       ?? "13:00",
    afternoonCheckInDeadline: policy?.afternoonCheckInDeadline ?? "13:15",
    graceMinutes:             policy?.graceMinutes             ?? 15,
    workingDays:              parseWorkingDays(policy?.workingDays),
  };

  const [liveRules, setLiveRules] = useState<RulesFormValues>(savedRules);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[3fr_2fr]">

      {/* ── Left column: configuration ─────────────────────────────── */}
      <div className="space-y-8 min-w-0">

        {/* Shifts section */}
        <section>
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <Shield className="h-3.5 w-3.5" />
            </div>
            <div>
              <h3 className="font-display text-sm font-semibold text-ink-900">Work Shifts</h3>
              <p className="text-xs text-ink-900/50">
                Define named work schedules for display purposes. Attendance sessions
                (morning and afternoon) now apply globally to all employees.
              </p>
            </div>
          </div>
          <ShiftsManager shifts={allShifts} />
        </section>

        <div className="h-px bg-ink-900/8" />

        {/* Rules section */}
        <section>
          <div className="mb-4">
            <h3 className="font-display text-sm font-semibold text-ink-900">Attendance Rules</h3>
            <p className="mt-0.5 text-xs text-ink-900/50">
              Configure morning and afternoon session deadlines. Each session is evaluated
              independently — morning attendance does not affect afternoon, and vice versa.
            </p>
          </div>
          <AttendanceRulesForm
            policy={policy}
            onValuesChange={setLiveRules}
          />
        </section>
      </div>

      {/* ── Right column: read-only overview + live preview ────────── */}
      <aside className="space-y-5 min-w-0">

        {/* Overview */}
        <div className="rounded-xl border border-ink-900/8 bg-white p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-900/40">
            Attendance Overview
          </p>
          <dl className="space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <dt className="text-ink-900/55">Morning deadline</dt>
              <dd className="font-medium text-ink-900">{fmtTime(liveRules.morningCheckInDeadline)}</dd>
            </div>
            <div className="flex items-center justify-between text-sm">
              <dt className="text-ink-900/55">Afternoon deadline</dt>
              <dd className="font-medium text-ink-900">{fmtTime(liveRules.afternoonCheckInDeadline)}</dd>
            </div>
            <div className="flex items-center justify-between text-sm">
              <dt className="text-ink-900/55">Grace period</dt>
              <dd className="font-medium text-ink-900">
                {liveRules.graceMinutes === 0
                  ? "None"
                  : liveRules.graceMinutes >= 60
                  ? `${Math.floor(liveRules.graceMinutes / 60)}h ${liveRules.graceMinutes % 60 > 0 ? `${liveRules.graceMinutes % 60}m` : ""}`.trim()
                  : `${liveRules.graceMinutes} min`}
              </dd>
            </div>
            <div className="flex items-center justify-between text-sm">
              <dt className="text-ink-900/55">Active shifts</dt>
              <dd className="font-medium text-ink-900">{activeShifts.length}</dd>
            </div>
            <div className="flex items-start justify-between gap-2 text-sm">
              <dt className="text-ink-900/55">Working days</dt>
              <dd className="text-right font-medium text-ink-900 text-xs">
                {liveRules.workingDays.length > 0
                  ? liveRules.workingDays.map((d) => DAY_LABELS[d]).join(", ")
                  : "—"}
              </dd>
            </div>
          </dl>
        </div>

        {/* Policy Preview */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-900/40">
            Policy Preview
          </p>
          <div className="rounded-xl border border-ink-900/8 bg-white p-3.5">
            <p className="mb-3 text-xs text-ink-900/45">
              Shows how attendance is classified by check-in time. Updates live as you edit.
            </p>
            <PolicyPreview rules={liveRules} />
          </div>
        </div>

        <p className="text-xs text-ink-900/35 text-center px-2">
          Changes apply to future check-ins only. Historical records are never modified.
        </p>
      </aside>
    </div>
  );
}
