"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import { Label, Select, Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import {
  LEAVE_TYPES,
  LEAVE_TYPE_LABELS,
  LEAVE_STATUSES,
  LEAVE_STATUS_LABELS,
} from "@/features/leave/schemas";
import type { ActionResult } from "@/lib/action-utils";

// ── Constants ────────────────────────────────────────────────────────────────

export const REPORT_TYPES = [
  { value: "EMPLOYEE_DIRECTORY", label: "Employee Directory" },
  { value: "ATTENDANCE_SUMMARY", label: "Attendance Summary" },
  { value: "LEAVE_SUMMARY", label: "Leave Summary" },
  { value: "HEADCOUNT", label: "Headcount" },
  { value: "COOPERATIVE_LISTING", label: "Cooperative Listing" },
  { value: "AUDIT_LOG", label: "Audit Log" },
] as const;

const EMPLOYMENT_STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "ON_LEAVE", label: "On Leave" },
  { value: "RESIGNED", label: "Resigned" },
  { value: "RETIRED", label: "Retired" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "TERMINATED", label: "Terminated" },
  { value: "INACTIVE", label: "Inactive" },
];

const EMPLOYMENT_TYPES = [
  { value: "PERMANENT", label: "Permanent" },
  { value: "CONTRACT", label: "Contract" },
  { value: "TEMPORARY", label: "Temporary" },
  { value: "PROBATION", label: "Probation" },
  { value: "INTERNSHIP", label: "Internship" },
];

const ATTENDANCE_STATUSES = [
  { value: "PRESENT", label: "Present" },
  { value: "ABSENT", label: "Absent" },
  { value: "LATE", label: "Late" },
  { value: "HALF_DAY", label: "Half Day" },
  { value: "EXCUSED", label: "Excused" },
  { value: "ON_LEAVE", label: "On Leave" },
];

// Build a list of recent years for the year filter (current year and 4 prior)
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

// ── Prop types ────────────────────────────────────────────────────────────────

export type FilterEmployee = {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
};

export type FilterDepartment = {
  id: string;
  name: string;
};

// ── Shared sub-components ─────────────────────────────────────────────────────

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border border-ink-900/8 bg-sand-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-900/40">{title}</p>
      {children}
    </div>
  );
}

function EmployeeDeptRow({
  employees,
  departments,
}: {
  employees: FilterEmployee[];
  departments: FilterDepartment[];
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <FieldGroup>
        <Label htmlFor="departmentId">Department</Label>
        <Select id="departmentId" name="departmentId" defaultValue="">
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </FieldGroup>
      <FieldGroup>
        <Label htmlFor="employeeId">Employee</Label>
        <Select id="employeeId" name="employeeId" defaultValue="">
          <option value="">All employees</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.firstName} {e.lastName} ({e.employeeId})
            </option>
          ))}
        </Select>
      </FieldGroup>
    </div>
  );
}

function YearDateRow() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <FieldGroup>
        <Label htmlFor="year">Year</Label>
        <Select id="year" name="year" defaultValue="">
          <option value="">All years</option>
          {YEAR_OPTIONS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </Select>
      </FieldGroup>
      <FieldGroup>
        <Label htmlFor="startDate">From date</Label>
        <Input id="startDate" name="startDate" type="date" />
      </FieldGroup>
      <FieldGroup>
        <Label htmlFor="endDate">To date</Label>
        <Input id="endDate" name="endDate" type="date" />
      </FieldGroup>
    </div>
  );
}

// ── Per-type filter panels ────────────────────────────────────────────────────

function EmployeeDirectoryFilters({
  employees,
  departments,
}: {
  employees: FilterEmployee[];
  departments: FilterDepartment[];
}) {
  return (
    <FilterSection title="Filters (optional)">
      <EmployeeDeptRow employees={employees} departments={departments} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FieldGroup>
          <Label htmlFor="employmentStatus">Employment status</Label>
          <Select id="employmentStatus" name="employmentStatus" defaultValue="">
            <option value="">All statuses</option>
            {EMPLOYMENT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="employmentType">Employment type</Label>
          <Select id="employmentType" name="employmentType" defaultValue="">
            <option value="">All types</option>
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </FieldGroup>
      </div>
      <YearDateRow />
      <p className="text-xs text-ink-900/40">
        Year / date range filters on hire date. Specifying both a year and a date range uses the date range.
      </p>
    </FilterSection>
  );
}

function AttendanceFilters({
  employees,
  departments,
}: {
  employees: FilterEmployee[];
  departments: FilterDepartment[];
}) {
  return (
    <FilterSection title="Filters (optional)">
      <EmployeeDeptRow employees={employees} departments={departments} />
      <FieldGroup>
        <Label htmlFor="attendanceStatus">Attendance status</Label>
        <Select id="attendanceStatus" name="attendanceStatus" defaultValue="">
          <option value="">All statuses</option>
          {ATTENDANCE_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </FieldGroup>
      <YearDateRow />
    </FilterSection>
  );
}

function LeaveSummaryFilters({
  employees,
  departments,
}: {
  employees: FilterEmployee[];
  departments: FilterDepartment[];
}) {
  return (
    <FilterSection title="Filters (optional)">
      <EmployeeDeptRow employees={employees} departments={departments} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FieldGroup>
          <Label htmlFor="leaveType">Leave type</Label>
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
      </div>
      <YearDateRow />
    </FilterSection>
  );
}

function HeadcountFilters({
  departments,
}: {
  departments: FilterDepartment[];
}) {
  return (
    <FilterSection title="Filters (optional)">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FieldGroup>
          <Label htmlFor="departmentId">Department</Label>
          <Select id="departmentId" name="departmentId" defaultValue="">
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="employmentStatus">Employment status</Label>
          <Select id="employmentStatus" name="employmentStatus" defaultValue="">
            <option value="">All statuses</option>
            {EMPLOYMENT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </FieldGroup>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FieldGroup>
          <Label htmlFor="employmentType">Employment type</Label>
          <Select id="employmentType" name="employmentType" defaultValue="">
            <option value="">All types</option>
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </FieldGroup>
      </div>
      <p className="text-xs text-ink-900/40">
        Selecting a specific department shows per-position breakdown instead of per-department.
      </p>
    </FilterSection>
  );
}

function CooperativeFilters() {
  return (
    <FilterSection title="Filters (optional)">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FieldGroup>
          <Label htmlFor="cooperativeStatus">Status</Label>
          <Select id="cooperativeStatus" name="cooperativeStatus" defaultValue="">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="cooperativeType">Type</Label>
          <Input
            id="cooperativeType"
            name="cooperativeType"
            placeholder="e.g. Grain Marketing"
          />
        </FieldGroup>
      </div>
      <YearDateRow />
      <p className="text-xs text-ink-900/40">
        Year / date range filters on registration date.
      </p>
    </FilterSection>
  );
}

function AuditLogFilters() {
  return (
    <FilterSection title="Filters (optional)">
      <YearDateRow />
    </FilterSection>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

export function GenerateReportForm({
  action,
  employees = [],
  departments = [],
}: {
  action: (prevState: unknown, formData: FormData) => Promise<unknown>;
  employees?: FilterEmployee[];
  departments?: FilterDepartment[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState<
    ActionResult<{ id: string; title: string }> | null,
    FormData
  >(action as (prev: ActionResult<{ id: string; title: string }> | null, data: FormData) => Promise<ActionResult<{ id: string; title: string }>>, null);

  const [selectedType, setSelectedType] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (state?.success) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToast(`"${state.data.title}" generated successfully.`);
      const t = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [state]);

  const error = state && !state.success ? state.error.message : null;

  function handleReset() {
    setSelectedType("");
    formRef.current?.reset();
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {toast && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-800"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          {toast}
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

      {/* Report type selector */}
      <FieldGroup>
        <Label htmlFor="type">Report type <span className="text-red-500">*</span></Label>
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

      {/* Per-type filter panels — only rendered when a type is selected */}
      {selectedType === "EMPLOYEE_DIRECTORY" && (
        <EmployeeDirectoryFilters employees={employees} departments={departments} />
      )}
      {selectedType === "ATTENDANCE_SUMMARY" && (
        <AttendanceFilters employees={employees} departments={departments} />
      )}
      {selectedType === "LEAVE_SUMMARY" && (
        <LeaveSummaryFilters employees={employees} departments={departments} />
      )}
      {selectedType === "HEADCOUNT" && (
        <HeadcountFilters departments={departments} />
      )}
      {selectedType === "COOPERATIVE_LISTING" && <CooperativeFilters />}
      {selectedType === "AUDIT_LOG" && <AuditLogFilters />}

      {/* Format selector */}
      <FieldGroup>
        <Label htmlFor="format">Output format</Label>
        <Select id="format" name="format" defaultValue="PDF">
          <option value="PDF">PDF</option>
          <option value="CSV">CSV (Excel)</option>
        </Select>
      </FieldGroup>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" className="flex-1" disabled={isPending || !selectedType}>
          {isPending ? (
            <span className="flex items-center gap-2">
              <svg
                className="h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              Generating…
            </span>
          ) : (
            "Generate Report"
          )}
        </Button>
        {selectedType && (
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={handleReset}
            title="Reset all filters"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="sr-only">Reset</span>
          </Button>
        )}
      </div>
    </form>
  );
}
