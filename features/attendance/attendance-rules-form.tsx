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

export type RulesFormValues = {
  morningStartTime:         string;
  morningCheckInDeadline:   string;
  afternoonStartTime:       string;
  afternoonCheckInDeadline: string;
  graceMinutes:             number;
  workingDays:              number[];
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
  const [morningStart,     setMorningStart]     = useState(policy?.morningStartTime         ?? "08:00");
  const [morningDeadline,  setMorningDeadline]  = useState(policy?.morningCheckInDeadline   ?? "08:15");
  const [afternoonStart,   setAfternoonStart]   = useState(policy?.afternoonStartTime       ?? "13:00");
  const [afternoonDeadline,setAfternoonDeadline]= useState(policy?.afternoonCheckInDeadline ?? "13:15");
  const [graceMinutes,     setGraceMinutes]     = useState(policy?.graceMinutes             ?? 15);
  const [workingDays, setWorkingDays] = useState<number[]>(savedWorkingDays);

  function notify(
    ms  = morningStart,
    md  = morningDeadline,
    as_ = afternoonStart,
    ad  = afternoonDeadline,
    gm  = graceMinutes,
    wd  = workingDays
  ) {
    onValuesChange?.({
      morningStartTime:         ms,
      morningCheckInDeadline:   md,
      afternoonStartTime:       as_,
      afternoonCheckInDeadline: ad,
      graceMinutes:             gm,
      workingDays:              wd,
    });
  }

  function toggleDay(day: number) {
    const next = workingDays.includes(day)
      ? workingDays.filter((d) => d !== day)
      : [...workingDays, day].sort((a, b) => a - b);
    setWorkingDays(next);
    notify(morningStart, morningDeadline, afternoonStart, afternoonDeadline, graceMinutes, next);
  }

  const didSucceed = state?.success === true;
  const error      = state && !state.success ? state.error.message : null;

  return (
    <form action={formAction} className="space-y-5">
      {didSucceed && (
        <div role="status" className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          Attendance policy saved successfully.
        </div>
      )}
      {error && (
        <div role="alert" className="flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
          <XCircle className="h-4 w-4 shrink-0 text-red-500" />
          {error}
        </div>
      )}

      {/* Morning session */}
      <fieldset className="rounded-lg border border-ink-900/10 p-4 space-y-4">
        <legend className="text-sm font-semibold text-ink-900 px-1">Morning Session</legend>

        <FieldGroup>
          <Label htmlFor="morningStartTime">Morning start time</Label>
          <Input
            id="morningStartTime"
            name="morningStartTime"
            type="time"
            value={morningStart}
            onChange={(e) => { setMorningStart(e.target.value); notify(e.target.value); }}
            required
            className="w-36"
          />
          <p className="mt-1 text-xs text-ink-900/45">
            Time (EAT, 24h) when the morning session begins.
          </p>
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="morningCheckInDeadline">Morning check-in deadline</Label>
          <Input
            id="morningCheckInDeadline"
            name="morningCheckInDeadline"
            type="time"
            value={morningDeadline}
            onChange={(e) => { setMorningDeadline(e.target.value); notify(undefined, e.target.value); }}
            required
            className="w-36"
          />
          <p className="mt-1 text-xs text-ink-900/45">
            Check-ins at or before this time are <strong>Present</strong>.
            After this time are <strong>Absent</strong>.
          </p>
        </FieldGroup>
      </fieldset>

      {/* Afternoon session */}
      <fieldset className="rounded-lg border border-ink-900/10 p-4 space-y-4">
        <legend className="text-sm font-semibold text-ink-900 px-1">Afternoon Session</legend>

        <FieldGroup>
          <Label htmlFor="afternoonStartTime">Afternoon start time</Label>
          <Input
            id="afternoonStartTime"
            name="afternoonStartTime"
            type="time"
            value={afternoonStart}
            onChange={(e) => { setAfternoonStart(e.target.value); notify(undefined, undefined, e.target.value); }}
            required
            className="w-36"
          />
          <p className="mt-1 text-xs text-ink-900/45">
            Check-ins at or after this time are routed to the afternoon session.
            Must be after the morning start time.
          </p>
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="afternoonCheckInDeadline">Afternoon check-in deadline</Label>
          <Input
            id="afternoonCheckInDeadline"
            name="afternoonCheckInDeadline"
            type="time"
            value={afternoonDeadline}
            onChange={(e) => { setAfternoonDeadline(e.target.value); notify(undefined, undefined, undefined, e.target.value); }}
            required
            className="w-36"
          />
          <p className="mt-1 text-xs text-ink-900/45">
            Check-ins at or before this time are <strong>Present</strong>.
            After this time are <strong>Absent</strong>.
          </p>
        </FieldGroup>
      </fieldset>

      {/* Working days */}
      <FieldGroup>
        <Label>Grace period (minutes)</Label>
        <Input
          id="graceMinutes"
          name="graceMinutes"
          type="number"
          min="0"
          max="240"
          value={graceMinutes}
          onChange={(e) => {
            const v = Math.max(0, Math.min(240, parseInt(e.target.value, 10) || 0));
            setGraceMinutes(v);
            notify(undefined, undefined, undefined, undefined, v);
          }}
          required
          className="w-28"
        />
        <p className="mt-1 text-xs text-ink-900/45">
          Minutes after the deadline before auto-absence fires.
          Check-ins within this window are marked <strong>Late</strong>.
          Set to 0 to disable grace (deadline = detection time).
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
          {isPending ? "Saving…" : "Save Policy"}
        </Button>
      </div>
    </form>
  );
}
