"use client";

import { useActionState, useEffect, useState } from "react";
import { Label, Select, Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { LEAVE_TYPES, LEAVE_TYPE_LABELS, LEAVE_STATUSES, LEAVE_STATUS_LABELS } from "@/features/leave/schemas";

const REPORT_TYPES = [
  { value: "EMPLOYEE_DIRECTORY", label: "Employee Directory" },
  { value: "ATTENDANCE_SUMMARY", label: "Attendance Summary" },
  { value: "COOPERATIVE_LISTING", label: "Cooperative Listing" },
  { value: "HEADCOUNT", label: "Headcount" },
  { value: "AUDIT_LOG", label: "Audit Log" },
  { value: "LEAVE_SUMMARY", label: "Leave Summary" },
] as const;

type LeaveFilterEmployee = { id: string; employeeId: string; firstName: string; lastName: string };

export function GenerateReportForm({
  action,
  leaveFilterEmployees = [],
}: {
  action: (prevState: unknown, formData: FormData) => Promise<unknown>;
  leaveFilterEmployees?: LeaveFilterEmployee[];
}) {
  const [state, formAction, isPending] = useActionState(action, null);
  const [selectedType, setSelectedType] = useState("");

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

  const isLeaveSummary = selectedType === "LEAVE_SUMMARY";

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
        <Select
          id="type"
          name="type"
          required
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
        >
          <option value="">Select a report…</option>
          {REPORT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </FieldGroup>

      {isLeaveSummary && (
        <div className="space-y-4 rounded-lg border border-ink-900/8 bg-sand-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-900/45">Leave filters (optional)</p>

          <FieldGroup>
            <Label htmlFor="leaveEmployeeId">Employee</Label>
            <Select id="leaveEmployeeId" name="leaveEmployeeId" defaultValue="">
              <option value="">All employees</option>
              {leaveFilterEmployees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.firstName} {e.lastName} ({e.employeeId})
                </option>
              ))}
            </Select>
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="leaveType">Leave Type</Label>
            <Select id="leaveType" name="leaveType" defaultValue="">
              <option value="">All leave types</option>
              {LEAVE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {LEAVE_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="leaveStatus">Status</Label>
            <Select id="leaveStatus" name="leaveStatus" defaultValue="">
              <option value="">All statuses</option>
              {LEAVE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {LEAVE_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </FieldGroup>

          <div className="grid grid-cols-2 gap-3">
            <FieldGroup>
              <Label htmlFor="leaveStartDate">From</Label>
              <Input id="leaveStartDate" name="leaveStartDate" type="date" />
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="leaveEndDate">To</Label>
              <Input id="leaveEndDate" name="leaveEndDate" type="date" />
            </FieldGroup>
          </div>
        </div>
      )}

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
