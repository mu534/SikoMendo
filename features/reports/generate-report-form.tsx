"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import { Label, Select, Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import {
  LEAVE_TYPES,
  LEAVE_STATUSES,
} from "@/features/leave/schemas";
import type { ActionResult } from "@/lib/action-utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type ReportActionResult = ActionResult<{ id: string; title: string }>;
type ReportAction = (
  prevState: ReportActionResult | null,
  formData: FormData
) => Promise<ReportActionResult>;

// ── Constants (value-only — labels come from t()) ────────────────────────────

export const REPORT_TYPES = [
  { value: "EMPLOYEE_DIRECTORY" },
  { value: "ATTENDANCE_SUMMARY" },
  { value: "LEAVE_SUMMARY" },
  { value: "HEADCOUNT" },
  { value: "COOPERATIVE_LISTING" },
  { value: "AUDIT_LOG" },
] as const;

const EMPLOYMENT_STATUS_VALUES = [
  "ACTIVE",
  "ON_LEAVE",
  "RESIGNED",
  "RETIRED",
  "SUSPENDED",
  "TERMINATED",
  "INACTIVE",
] as const;

const EMPLOYMENT_TYPE_VALUES = [
  "PERMANENT",
  "CONTRACT",
  "TEMPORARY",
  "PROBATION",
  "INTERNSHIP",
] as const;

const ATTENDANCE_STATUS_VALUES = [
  "PRESENT",
  "ABSENT",
  "LATE",
  "HALF_DAY",
  "EXCUSED",
  "ON_LEAVE",
] as const;

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

// ── Main form ─────────────────────────────────────────────────────────────────

export function GenerateReportForm({
  action,
  employees = [],
  departments = [],
}: {
  action: ReportAction;
  employees?: FilterEmployee[];
  departments?: FilterDepartment[];
}) {
  const t = useTranslations("reports");
  const tLeave = useTranslations("leave");

  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState<ReportActionResult | null, FormData>(
    action,
    null
  );

  const [selectedType, setSelectedType] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (state?.success) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToast(t("success.generated", { title: state.data.title }));
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [state, t]);

  const error = state && !state.success ? state.error.message : null;

  function handleReset() {
    setSelectedType("");
    formRef.current?.reset();
  }

  // ── Shared inner sub-components ─────────────────────────────────────────────

  function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div className="space-y-3 rounded-xl border border-ink-900/8 bg-sand-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-900/40">{title}</p>
        {children}
      </div>
    );
  }

  function EmployeeDeptRow() {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FieldGroup>
          <Label htmlFor="departmentId">{t("form.filters.department")}</Label>
          <Select id="departmentId" name="departmentId" defaultValue="">
            <option value="">{t("form.filters.allDepartments")}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="employeeId">{t("form.filters.employee")}</Label>
          <Select id="employeeId" name="employeeId" defaultValue="">
            <option value="">{t("form.filters.allEmployees")}</option>
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
          <Label htmlFor="year">{t("form.filters.year")}</Label>
          <Select id="year" name="year" defaultValue="">
            <option value="">{t("form.filters.allYears")}</option>
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="startDate">{t("form.filters.startDate")}</Label>
          <Input id="startDate" name="startDate" type="date" />
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="endDate">{t("form.filters.endDate")}</Label>
          <Input id="endDate" name="endDate" type="date" />
        </FieldGroup>
      </div>
    );
  }

  // ── Per-type filter panels ─────────────────────────────────────────────────

  function EmployeeDirectoryFilters() {
    return (
      <FilterSection title={t("form.filters.title")}>
        <EmployeeDeptRow />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="employmentStatus">{t("form.filters.employmentStatus")}</Label>
            <Select id="employmentStatus" name="employmentStatus" defaultValue="">
              <option value="">{t("form.filters.allStatuses")}</option>
              {EMPLOYMENT_STATUS_VALUES.map((s) => (
                <option key={s} value={s}>
                  {t(`employmentStatus.${s}`)}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="employmentType">{t("form.filters.employmentType")}</Label>
            <Select id="employmentType" name="employmentType" defaultValue="">
              <option value="">{t("form.filters.allTypes")}</option>
              {EMPLOYMENT_TYPE_VALUES.map((et) => (
                <option key={et} value={et}>
                  {t(`employmentType.${et}`)}
                </option>
              ))}
            </Select>
          </FieldGroup>
        </div>
        <YearDateRow />
        <p className="text-xs text-ink-900/40">
          {t("form.filters.hireDateNote")}
        </p>
      </FilterSection>
    );
  }

  function AttendanceFilters() {
    return (
      <FilterSection title={t("form.filters.title")}>
        <EmployeeDeptRow />
        <FieldGroup>
          <Label htmlFor="attendanceStatus">{t("form.filters.attendanceStatus")}</Label>
          <Select id="attendanceStatus" name="attendanceStatus" defaultValue="">
            <option value="">{t("form.filters.allStatuses")}</option>
            {ATTENDANCE_STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {t(`attendanceStatus.${s}`)}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <YearDateRow />
      </FilterSection>
    );
  }

  function LeaveSummaryFilters() {
    return (
      <FilterSection title={t("form.filters.title")}>
        <EmployeeDeptRow />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="leaveType">{t("form.filters.leaveType")}</Label>
            <Select id="leaveType" name="leaveType" defaultValue="">
              <option value="">{t("form.filters.allLeaveTypes")}</option>
              {LEAVE_TYPES.map((lv) => (
                <option key={lv} value={lv}>
                  {tLeave(`types.${lv}`)}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="leaveStatus">{t("form.filters.leaveStatus")}</Label>
            <Select id="leaveStatus" name="leaveStatus" defaultValue="">
              <option value="">{t("form.filters.allStatuses")}</option>
              {LEAVE_STATUSES.map((ls) => (
                <option key={ls} value={ls}>
                  {tLeave(`statuses.${ls}`)}
                </option>
              ))}
            </Select>
          </FieldGroup>
        </div>
        <YearDateRow />
      </FilterSection>
    );
  }

  function HeadcountFilters() {
    return (
      <FilterSection title={t("form.filters.title")}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="departmentId">{t("form.filters.department")}</Label>
            <Select id="departmentId" name="departmentId" defaultValue="">
              <option value="">{t("form.filters.allDepartments")}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="employmentStatus">{t("form.filters.employmentStatus")}</Label>
            <Select id="employmentStatus" name="employmentStatus" defaultValue="">
              <option value="">{t("form.filters.allStatuses")}</option>
              {EMPLOYMENT_STATUS_VALUES.map((s) => (
                <option key={s} value={s}>
                  {t(`employmentStatus.${s}`)}
                </option>
              ))}
            </Select>
          </FieldGroup>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="employmentType">{t("form.filters.employmentType")}</Label>
            <Select id="employmentType" name="employmentType" defaultValue="">
              <option value="">{t("form.filters.allTypes")}</option>
              {EMPLOYMENT_TYPE_VALUES.map((et) => (
                <option key={et} value={et}>
                  {t(`employmentType.${et}`)}
                </option>
              ))}
            </Select>
          </FieldGroup>
        </div>
        <p className="text-xs text-ink-900/40">
          {t("form.filters.headcountDeptNote")}
        </p>
      </FilterSection>
    );
  }

  function CooperativeFilters() {
    return (
      <FilterSection title={t("form.filters.title")}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="cooperativeStatus">{t("form.filters.cooperativeStatus")}</Label>
            <Select id="cooperativeStatus" name="cooperativeStatus" defaultValue="">
              <option value="">{t("form.filters.allCooperativeStatuses")}</option>
              <option value="active">{t("cooperativeStatus.active")}</option>
              <option value="inactive">{t("cooperativeStatus.inactive")}</option>
            </Select>
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="cooperativeType">{t("form.filters.cooperativeType")}</Label>
            <Input
              id="cooperativeType"
              name="cooperativeType"
              placeholder={t("form.filters.cooperativeTypePlaceholder")}
            />
          </FieldGroup>
        </div>
        <YearDateRow />
        <p className="text-xs text-ink-900/40">
          {t("form.filters.cooperativeDateNote")}
        </p>
      </FilterSection>
    );
  }

  function AuditLogFilters() {
    return (
      <FilterSection title={t("form.filters.title")}>
        <YearDateRow />
      </FilterSection>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

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
        <Label htmlFor="type">
          {t("form.reportType")} <span className="text-red-500">*</span>
        </Label>
        <Select
          id="type"
          name="type"
          required
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
        >
          <option value="">{t("form.selectReport")}</option>
          {REPORT_TYPES.map((rt) => (
            <option key={rt.value} value={rt.value}>
              {t(`types.${rt.value}`)}
            </option>
          ))}
        </Select>
      </FieldGroup>

      {/* Per-type filter panels — only rendered when a type is selected */}
      {selectedType === "EMPLOYEE_DIRECTORY" && <EmployeeDirectoryFilters />}
      {selectedType === "ATTENDANCE_SUMMARY" && <AttendanceFilters />}
      {selectedType === "LEAVE_SUMMARY" && <LeaveSummaryFilters />}
      {selectedType === "HEADCOUNT" && <HeadcountFilters />}
      {selectedType === "COOPERATIVE_LISTING" && <CooperativeFilters />}
      {selectedType === "AUDIT_LOG" && <AuditLogFilters />}

      {/* Format selector */}
      <FieldGroup>
        <Label htmlFor="format">{t("form.outputFormat")}</Label>
        <Select id="format" name="format" defaultValue="PDF">
          <option value="PDF">{t("formats.PDF")}</option>
          <option value="CSV">{t("formats.CSV")}</option>
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
              {t("form.generating")}
            </span>
          ) : (
            t("form.generate")
          )}
        </Button>
        {selectedType && (
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={handleReset}
            title={t("form.reset")}
          >
            <RotateCcw className="h-4 w-4" />
            <span className="sr-only">{t("form.reset")}</span>
          </Button>
        )}
      </div>
    </form>
  );
}
