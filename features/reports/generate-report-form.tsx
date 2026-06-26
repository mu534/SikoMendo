"use client";

import { useActionState, useEffect, useState } from "react";
import { Label, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const REPORT_TYPES = [
  { value: "EMPLOYEE_DIRECTORY", label: "Employee Directory" },
  { value: "ATTENDANCE_SUMMARY", label: "Attendance Summary" },
  { value: "COOPERATIVE_LISTING", label: "Cooperative Listing" },
  { value: "HEADCOUNT", label: "Headcount" },
  { value: "AUDIT_LOG", label: "Audit Log" },
] as const;

export function GenerateReportForm({
  action,
}: {
  action: (prevState: unknown, formData: FormData) => Promise<unknown>;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [state, formAction, isPending] = useActionState(action as any, null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (state && (state as { success: boolean }).success === true) {
      const title = (state as { data: { title: string } }).data.title;
      setSuccessMessage(`"${title}" has been generated successfully.`);
      const t = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [state]);

  const stateTyped = state as
    | { success: true; data: { id: string; title: string } }
    | { success: false; error: { message: string } }
    | null;

  const errorMessage =
    stateTyped && stateTyped.success === false ? stateTyped.error.message : null;

  return (
    <form action={formAction} className="space-y-4">
      {successMessage && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm font-medium text-green-800"
        >
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700"
        >
          {errorMessage}
        </div>
      )}

      <FieldGroup>
        <Label htmlFor="type">Report Type</Label>
        <Select id="type" name="type" required>
          <option value="">Select a report…</option>
          {REPORT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="format">Format</Label>
        <Select id="format" name="format" defaultValue="PDF">
          <option value="PDF">PDF</option>
          <option value="CSV">CSV</option>
        </Select>
      </FieldGroup>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? (
          <span className="flex items-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Generating…
          </span>
        ) : (
          "Generate Report"
        )}
      </Button>
    </form>
  );
}
