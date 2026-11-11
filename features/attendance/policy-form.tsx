"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, XCircle } from "lucide-react";
import { upsertAttendancePolicy } from "./policy-actions";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldGroup } from "@/components/ui/field";

const WEEKDAY_KEYS = [
  { value: 1, key: "monday" as const },
  { value: 2, key: "tuesday" as const },
  { value: 3, key: "wednesday" as const },
  { value: 4, key: "thursday" as const },
  { value: 5, key: "friday" as const },
  { value: 6, key: "saturday" as const },
  { value: 7, key: "sunday" as const },
];

type PolicyRow = {
  morningStartTime: string;
  morningCheckInDeadline: string;
  afternoonStartTime: string;
  afternoonCheckInDeadline: string;
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

export function AttendancePolicyForm({ policy }: { policy: PolicyRow }) {
  const [state, formAction, isPending] = useActionState(upsertAttendancePolicy, null);
  const t = useTranslations("attendance.policy");
  const tC = useTranslations("common");

  const workingDays = parseWorkingDays(policy?.workingDays);
  const didSucceed = state?.success === true;
  const error = state && !state.success ? state.error.message : null;

  return (
    <form action={formAction} className="space-y-6">
      {didSucceed && (
        <div role="status" className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          {t("savePolicy")}
        </div>
      )}
      {error && (
        <div role="alert" className="flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
          <XCircle className="h-4 w-4 shrink-0 text-red-500" />
          {error}
        </div>
      )}

      {/* ── Morning Session ─────────────────────────────────────────────── */}
      <fieldset className="rounded-lg border border-ink-900/12 p-4 space-y-4">
        <legend className="px-1 text-sm font-semibold text-ink-900">{t("morningSession")}</legend>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="morningStartTime">{t("morningStartTime")}</Label>
            <Input
              id="morningStartTime"
              name="morningStartTime"
              type="time"
              defaultValue={policy?.morningStartTime ?? "08:00"}
              required
            />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="morningCheckInDeadline">{t("morningCheckInDeadline")}</Label>
            <Input
              id="morningCheckInDeadline"
              name="morningCheckInDeadline"
              type="time"
              defaultValue={policy?.morningCheckInDeadline ?? "08:15"}
              required
            />
          </FieldGroup>
        </div>
      </fieldset>

      {/* ── Afternoon Session ───────────────────────────────────────────── */}
      <fieldset className="rounded-lg border border-ink-900/12 p-4 space-y-4">
        <legend className="px-1 text-sm font-semibold text-ink-900">{t("afternoonSession")}</legend>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="afternoonStartTime">{t("afternoonStartTime")}</Label>
            <Input
              id="afternoonStartTime"
              name="afternoonStartTime"
              type="time"
              defaultValue={policy?.afternoonStartTime ?? "13:00"}
              required
            />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="afternoonCheckInDeadline">{t("afternoonCheckInDeadline")}</Label>
            <Input
              id="afternoonCheckInDeadline"
              name="afternoonCheckInDeadline"
              type="time"
              defaultValue={policy?.afternoonCheckInDeadline ?? "13:15"}
              required
            />
          </FieldGroup>
        </div>
      </fieldset>

      {/* ── Working Days ─────────────────────────────────────────────────── */}
      <FieldGroup>
        <Label>{t("workingDays")}</Label>
        <div className="flex flex-wrap gap-2 pt-1">
          {WEEKDAY_KEYS.map((day) => (
            <label
              key={day.value}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-ink-900/15 bg-white px-3 py-2 text-sm font-medium text-ink-900 has-[:checked]:border-brand-700 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-700"
            >
              <input
                type="checkbox"
                name={`workingDay_${day.value}`}
                defaultChecked={workingDays.includes(day.value)}
                className="h-3.5 w-3.5 rounded border-ink-900/25 accent-brand-700"
              />
              {t(day.key)}
            </label>
          ))}
        </div>
      </FieldGroup>

      <div className="pt-1">
        <Button type="submit" disabled={isPending} size="md">
          {isPending ? tC("saving") : t("savePolicy")}
        </Button>
      </div>
    </form>
  );
}
