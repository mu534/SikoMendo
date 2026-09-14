"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { upsertAttendancePolicy } from "./policy-actions";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldGroup } from "@/components/ui/field";

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
];

type PolicyRow = {
  workStartTime: string;
  workEndTime: string;
  gracePeriodMinutes: number;
  halfDayThresholdMinutes: number | null;
  workingDays: string;
} | null;

function parseWorkingDays(raw: string | null | undefined): number[] {
  try {
    const parsed = JSON.parse(raw ?? "[1,2,3,4,5]");
    return Array.isArray(parsed) ? parsed : [1, 2, 3, 4, 5];
  } catch {
    return [1, 2, 3, 4, 5];
  }
}

export type RulesFormValues = {
  gracePeriodMinutes: number;
  halfDayThresholdMinutes: number | string;
  workingDays: number[];
};

export function AttendanceRulesForm({
  policy,
  onValuesChange,
}: {
  policy: PolicyRow;
  /** Called on every input change so the live preview can update. */
  onValuesChange?: (values: RulesFormValues) => void;
}) {
  const [state, formAction, isPending] = useActionState(upsertAttendancePolicy, null);

  const savedWorkingDays = parseWorkingDays(policy?.workingDays);

  // Controlled state for live preview
  const [grace, setGrace]           = useState(String(policy?.gracePeriodMinutes ?? 15));
  const [halfDay, setHalfDay]       = useState(
    policy?.halfDayThresholdMinutes != null ? String(policy.halfDayThresholdMinutes) : ""
  );
  const [workingDays, setWorkingDays] = useState<number[]>(savedWorkingDays);

  function notify(
    g = grace,
    hd = halfDay,
    wd = workingDays
  ) {
    onValuesChange?.({
      gracePeriodMinutes: parseInt(g, 10) || 0,
      halfDayThresholdMinutes: hd.trim() !== "" ? (parseInt(hd, 10) || "") : "",
      workingDays: wd,
    });
  }

  function toggleDay(day: number) {
    const next = workingDays.includes(day)
      ? workingDays.filter((d) => d !== day)
      : [...workingDays, day].sort((a, b) => a - b);
    setWorkingDays(next);
    notify(grace, halfDay, next);
  }

  const didSucceed = state?.success === true;
  const error      = state && !state.success ? state.error.message : null;

  return (
    <form action={formAction} className="space-y-5">
      {didSucceed && (
        <div role="status" className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          Attendance rules saved successfully.
        </div>
      )}
      {error && (
        <div role="alert" className="flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
          <XCircle className="h-4 w-4 shrink-0 text-red-500" />
          {error}
        </div>
      )}

      {/* Hidden: keep workStartTime/workEndTime so the existing action still works */}
      <input type="hidden" name="workStartTime" value={policy?.workStartTime ?? "08:00"} />
      <input type="hidden" name="workEndTime"   value={policy?.workEndTime   ?? "17:00"} />

      {/* Grace period */}
      <FieldGroup>
        <Label htmlFor="gracePeriodMinutes">Grace period (minutes)</Label>
        <Input
          id="gracePeriodMinutes"
          name="gracePeriodMinutes"
          type="number"
          min="0"
          max="120"
          value={grace}
          onChange={(e) => { setGrace(e.target.value); notify(e.target.value, halfDay, workingDays); }}
          required
          className="w-28"
        />
        <p className="mt-1 text-xs text-ink-900/45">
          Minutes after shift start within which check-in is still <strong>Present</strong>.
        </p>
      </FieldGroup>

      {/* Half-day threshold */}
      <FieldGroup>
        <Label htmlFor="halfDayThresholdMinutes">Half-day threshold (minutes, optional)</Label>
        <Input
          id="halfDayThresholdMinutes"
          name="halfDayThresholdMinutes"
          type="number"
          min="1"
          max="480"
          value={halfDay}
          onChange={(e) => { setHalfDay(e.target.value); notify(grace, e.target.value, workingDays); }}
          placeholder="Leave blank to disable"
          className="w-40"
        />
        <p className="mt-1 text-xs text-ink-900/45">
          Minutes after the grace period cutoff at which a late arrival becomes{" "}
          <strong>Half Day</strong>. Leave blank for Present / Late only.
        </p>
      </FieldGroup>

      {/* Working days */}
      <FieldGroup>
        <Label>Working days</Label>
        <div className="flex flex-wrap gap-2 pt-1">
          {WEEKDAYS.map((day) => {
            const checked = workingDays.includes(day.value);
            return (
              <label
                key={day.value}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-ink-900/15 bg-white px-3 py-2 text-sm font-medium text-ink-900 has-[:checked]:border-brand-700 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-700"
              >
                <input
                  type="checkbox"
                  name={`workingDay_${day.value}`}
                  checked={checked}
                  onChange={() => toggleDay(day.value)}
                  className="h-3.5 w-3.5 rounded border-ink-900/25 accent-brand-700"
                />
                {day.label}
              </label>
            );
          })}
        </div>
        <p className="mt-1 text-xs text-ink-900/45">
          Attendance tracking applies on these days. Other days are non-working.
        </p>
      </FieldGroup>

      <div className="pt-1">
        <Button type="submit" disabled={isPending} size="md">
          {isPending ? "Saving…" : "Save Rules"}
        </Button>
      </div>
    </form>
  );
}
