"use client";

import { useActionState } from "react";
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
  workingDays: string; // JSON array string e.g. "[1,2,3,4,5]"
} | null;

function parseWorkingDays(raw: string | null | undefined): number[] {
  try {
    const parsed = JSON.parse(raw ?? "[1,2,3,4,5]");
    return Array.isArray(parsed) ? parsed : [1, 2, 3, 4, 5];
  } catch {
    return [1, 2, 3, 4, 5];
  }
}

export function AttendancePolicyForm({ policy }: { policy: PolicyRow }) {
  const [state, formAction, isPending] = useActionState(upsertAttendancePolicy, null);

  const workingDays = parseWorkingDays(policy?.workingDays);

  const didSucceed = state?.success === true;
  const error =
    state && !state.success ? state.error.message : null;

  return (
    <form action={formAction} className="space-y-6">
      {didSucceed && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-800"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          Attendance policy saved successfully.
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700"
        >
          <XCircle className="h-4 w-4 shrink-0 text-red-500" />
          {error}
        </div>
      )}

      {/* Work hours */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldGroup>
          <Label htmlFor="workStartTime">Work start time</Label>
          <Input
            id="workStartTime"
            name="workStartTime"
            type="time"
            defaultValue={policy?.workStartTime ?? "08:00"}
            required
          />
          <p className="mt-1 text-xs text-ink-900/45">
            The official start of the working day (org-local time, EAT).
          </p>
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="workEndTime">Work end time</Label>
          <Input
            id="workEndTime"
            name="workEndTime"
            type="time"
            defaultValue={policy?.workEndTime ?? "17:00"}
            required
          />
          <p className="mt-1 text-xs text-ink-900/45">
            The official end of the working day.
          </p>
        </FieldGroup>
      </div>

      {/* Grace period */}
      <FieldGroup>
        <Label htmlFor="gracePeriodMinutes">Grace period (minutes)</Label>
        <Input
          id="gracePeriodMinutes"
          name="gracePeriodMinutes"
          type="number"
          min="0"
          max="120"
          defaultValue={policy?.gracePeriodMinutes ?? 15}
          required
          className="w-32"
        />
        <p className="mt-1 text-xs text-ink-900/45">
          Minutes after work start time during which a check-in is still counted as{" "}
          <strong>Present</strong>. E.g. 15 min grace with 08:00 start → 08:15 is still Present,
          08:16 is Late.
        </p>
      </FieldGroup>

      {/* Half-day threshold */}
      <FieldGroup>
        <Label htmlFor="halfDayThresholdMinutes">
          Half-day threshold (minutes, optional)
        </Label>
        <Input
          id="halfDayThresholdMinutes"
          name="halfDayThresholdMinutes"
          type="number"
          min="1"
          max="480"
          defaultValue={policy?.halfDayThresholdMinutes ?? ""}
          placeholder="Leave blank to disable"
          className="w-48"
        />
        <p className="mt-1 text-xs text-ink-900/45">
          Minutes after the grace period at which a late arrival becomes{" "}
          <strong>Half Day</strong>. Leave blank if you only want Present and Late statuses.
          E.g. 120 min → arriving more than 2 h after the grace cutoff = Half Day.
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
                  defaultChecked={checked}
                  className="h-3.5 w-3.5 rounded border-ink-900/25 accent-brand-700"
                />
                {day.label}
              </label>
            );
          })}
        </div>
        <p className="mt-1 text-xs text-ink-900/45">
          Attendance tracking applies on these days. Other days are treated as non-working.
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
