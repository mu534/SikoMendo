"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { User, Briefcase, Phone, Search, GraduationCap } from "lucide-react";
import { Input, Label, Select, Textarea, FieldGroup, FieldError } from "@/components/ui/field";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PhotoInput } from "./photo-input";
import { SectionHeader } from "./section-header";
import type { EducationRecordInput } from "./schemas";
import { EMERGENCY_CONTACT_RELATIONSHIPS } from "./schemas";
import { PhoneInput } from "./phone-input";

// Load the interactive education section client-only so the server never
// renders a version of it. This eliminates the SSR/hydration mismatch caused
// by useId() generating different prefixes on server vs client in React 19
// (server: _R_nnn, client: _r_nnn), and by the Turbopack module cache serving
// stale compiled bundles for "use client" components during hot reload.
// The education section has no server-side rendering value: it manages local
// state entirely and submits via server action through a hidden JSON input.
const EducationSection = dynamic(
  () => import("./education-section").then((m) => ({ default: m.EducationSection })),
  { ssr: false }
);

export { SectionHeader } from "./section-header";

export const EMPLOYEE_FORM_ID = "employee-form";

type EmploymentStatus =
  | "ONBOARDING" | "ACTIVE" | "ON_LEAVE" | "RESIGNED" | "RETIRED"
  | "SUSPENDED" | "TERMINATED" | "INACTIVE";

export type DepartmentOption = { id: string; name: string };
export type PositionOption   = { id: string; name: string; departmentId: string; isManagerPosition: boolean; departmentHasManager: boolean };
export type ManagerOption    = {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  position?: { name: string } | null;
};

export type DepartmentWithManager = {
  id: string;
  name: string;
  managerId: string | null;
  manager: ManagerOption | null;
};

export type EmployeeFormValues = {
  id?: string;
  employeeId?: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  gender?: "MALE" | "FEMALE" | null;
  dateOfBirth?: string | null;
  maritalStatus?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelationship?: string | null;
  emergencyContactAddress?: string | null;
  emergencyContactAltPhone?: string | null;
  emergencyContactEmail?: string | null;
  emergencyContactAddressCity?: string | null;
  emergencyContactAddressRegion?: string | null;
  emergencyContactAddressPostalCode?: string | null;
  emergencyContact2Name?: string | null;
  emergencyContact2Phone?: string | null;
  emergencyContact2Relationship?: string | null;
  emergencyContactConsentRecorded?: boolean | null;
  departmentId?: string | null;
  positionId?: string | null;
  managerId?: string | null;
  employmentType?: string | null;
  hireDate?: string | null;
  employmentStatus: EmploymentStatus;
  /** Education qualifications — replaces the four legacy flat fields. */
  educations?: EducationRecordInput[];
  profileImageUrl?: string | null;
};

function toDateInputValue(date?: string | null) {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

function RequiredMark() {
  return <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>;
}

// ── Searchable Manager Combobox ───────────────────────────────────────────────

function ManagerCombobox({
  managers,
  defaultValue,
  name,
  required = false,
}: {
  managers: ManagerOption[];
  defaultValue?: string | null;
  name: string;
  required?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ManagerOption | null>(
    managers.find((m) => m.id === defaultValue) ?? null
  );
  const t = useTranslations("employees");
  const tC = useTranslations("common");

  const filtered =
    query.trim() === ""
      ? managers.slice(0, 12)
      : managers.filter((m) => {
          const full = `${m.firstName} ${m.lastName} ${m.employeeId}`.toLowerCase();
          return full.includes(query.toLowerCase());
        }).slice(0, 12);

  return (
    <div className="relative">
      <input type="hidden" name={name} value={selected?.id ?? ""} />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-900/35" aria-hidden="true" />
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={`${name}-listbox`}
          aria-label={t("form.selectManager")}
          placeholder={selected ? `${selected.firstName} ${selected.lastName}` : t("form.selectManager")}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="w-full rounded-lg border border-ink-900/15 bg-white py-2 pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-900/35 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
        />
      </div>

      {selected && !open && (
        <div className="mt-1.5 flex items-center justify-between rounded-lg border border-ink-900/8 bg-sand-50 px-3 py-2">
          <div>
            <p className="text-sm font-medium text-ink-900">{selected.firstName} {selected.lastName}</p>
            <p className="text-xs text-ink-900/45">{selected.employeeId}{selected.position?.name ? ` · ${selected.position.name}` : ""}</p>
          </div>
          {!required && (
            <button type="button" onClick={() => { setSelected(null); setQuery(""); }} className="text-xs font-medium text-ink-900/40 hover:text-ink-900" aria-label={tC("clear")}>
              {tC("clear")}
            </button>
          )}
        </div>
      )}

      {open && (
        <ul role="listbox" id={`${name}-listbox`} aria-label={t("form.manager")} className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-ink-900/10 bg-white py-1 shadow-lg shadow-ink-900/8">
          {!required && (
            <li role="option" aria-selected={!selected} onMouseDown={() => { setSelected(null); setQuery(""); setOpen(false); }} className="cursor-pointer px-3 py-2 text-sm text-ink-900/45 hover:bg-sand-50">
              {tC("none")}
            </li>
          )}
          {filtered.length === 0 && <li className="px-3 py-2 text-sm text-ink-900/40">{tC("noResults")}</li>}
          {filtered.map((m) => (
            <li key={m.id} role="option" aria-selected={selected?.id === m.id}
              onMouseDown={() => { setSelected(m); setQuery(""); setOpen(false); }}
              className={`cursor-pointer px-3 py-2.5 hover:bg-sand-50 ${selected?.id === m.id ? "bg-brand-50" : ""}`}>
              <p className="text-sm font-medium text-ink-900">{m.firstName} {m.lastName}</p>
              <p className="text-xs text-ink-900/45">{m.employeeId}{m.position?.name ? ` · ${m.position.name}` : ""}</p>
            </li>
          ))}
          {managers.length > 12 && filtered.length === 12 && (
            <li className="px-3 py-1.5 text-xs text-ink-900/35">{tC("search")}</li>
          )}
        </ul>
      )}
    </div>
  );
}

// ── Emergency Contact — Relationship dropdown ─────────────────────────────
//
// A controlled dropdown for relationship type. When "Other" is selected it
// reveals a free-text input. The resolved value (either the selected option or
// the custom text) is submitted via a hidden input as "emergencyContactRelationship"
// so the rest of the form/schema receives a single string, no new DB column needed.

const OTHER_SENTINEL = "Other";

function RelationshipSelect({
  defaultValue,
  name = "emergencyContactRelationship",
}: {
  defaultValue?: string | null;
  name?: string;
}) {
  const t = useTranslations("employees");
  const namedOptions = new Set<string>(EMERGENCY_CONTACT_RELATIONSHIPS);
  const isStoredOther = !!defaultValue && !namedOptions.has(defaultValue);

  const [selected, setSelected] = useState<string>(
    isStoredOther ? OTHER_SENTINEL : (defaultValue ?? "")
  );
  const [customText, setCustomText] = useState<string>(
    isStoredOther ? (defaultValue ?? "") : ""
  );

  const isOther = selected === OTHER_SENTINEL;
  const resolvedValue = isOther ? customText.trim() : selected;
  const inputId = `${name}Select`;

  return (
    <>
      <input type="hidden" name={name} value={resolvedValue} />
      <div className="relative">
        <Select id={inputId} value={selected} onChange={(e) => { setSelected(e.target.value); if (e.target.value !== OTHER_SENTINEL) setCustomText(""); }}>
          <option value="">{t("form.selectRelationship")}</option>
          {EMERGENCY_CONTACT_RELATIONSHIPS.map((r) => (
            <option key={r} value={r}>{t(`relationships.${r}` as Parameters<typeof t>[0])}</option>
          ))}
        </Select>
      </div>
      {isOther && (
        <FieldGroup className="mt-3">
          <Label htmlFor={`${name}Other`}>{t("form.emergencyContactRelationship")}<RequiredMark /></Label>
          <Input id={`${name}Other`} value={customText} onChange={(e) => setCustomText(e.target.value)} required />
        </FieldGroup>
      )}
    </>
  );
}

// ── Form actions bar ──────────────────────────────────────────────────────────

export function EmployeeFormActions({
  isPending,
  isEdit,
  onCancel,
}: {
  isPending?: boolean;
  isEdit?: boolean;
  onCancel?: () => void;
}) {
  const t = useTranslations("employees");
  const tC = useTranslations("common");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="submit" form={EMPLOYEE_FORM_ID} disabled={isPending}>
        {isPending ? (
          <span className="flex items-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            {tC("saving")}
          </span>
        ) : isEdit ? tC("save") : t("newEmployee")}
      </Button>
      {isEdit && onCancel ? (
        <Button type="button" variant="outline" onClick={onCancel}>{tC("cancel")}</Button>
      ) : isEdit ? (
        <Button type="reset" form={EMPLOYEE_FORM_ID} variant="outline">{tC("clear")}</Button>
      ) : (
        <>
          <Button type="reset" form={EMPLOYEE_FORM_ID} variant="outline">{tC("clear")}</Button>
          <ButtonLink href="/employees" variant="ghost">{tC("cancel")}</ButtonLink>
        </>
      )}
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

export function EmployeeForm({
  action,
  employee,
  departments = [],
  positions = [],
  managers = [],
  departmentsWithManagers,
  onSaveSuccess,
}: {
  action: (
    prevState: { success: boolean; data?: unknown; error?: { message: string } } | null,
    formData: FormData
  ) => Promise<{ success: boolean; data?: unknown; error?: { message: string } }>;
  employee?: EmployeeFormValues;
  departments?: DepartmentOption[];
  positions?: PositionOption[];
  managers?: ManagerOption[];
  /** When provided (create mode), manager is derived from the selected department instead of the managers array. */
  departmentsWithManagers?: DepartmentWithManager[];
  onSaveSuccess?: () => void;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(action, null);
  const t = useTranslations("employees");
  const tC = useTranslations("common");

  // Cascading department→position filter
  const [selectedDeptId, setSelectedDeptId] = useState(employee?.departmentId ?? "");
  const filteredPositions = selectedDeptId
    ? positions.filter((p) => p.departmentId === selectedDeptId)
    : positions;

  const [selectedPosId, setSelectedPosId] = useState(employee?.positionId ?? "");
  function handleDeptChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedDeptId(e.target.value);
    setSelectedPosId("");
  }

  // Date of birth — client-side minimum-age validation
  // Employee must be strictly older than 20 (i.e. turned 21 or older already).
  const [dobError, setDobError] = useState<string | null>(null);

  // Maximum selectable birthday: exactly 21 years before today (calendar-accurate).
  // Computed at render time so the restriction is always current.
  const maxDob = (() => {
    const today = new Date();
    return new Date(
      today.getFullYear() - 21,
      today.getMonth(),
      today.getDate()
    ).toISOString().slice(0, 10);
  })();

  function validateDob(value: string) {
    if (!value) { setDobError(t("form.dateOfBirth")); return; }
    const dob = new Date(value);
    if (isNaN(dob.getTime())) { setDobError(tC("required")); return; }
    const today = new Date();
    if (dob > today) { setDobError(tC("required")); return; }
    const threshold = new Date(today.getFullYear() - 21, today.getMonth(), today.getDate());
    if (dob > threshold) {
      setDobError(t("form.minAgeError"));
    } else {
      setDobError(null);
    }
  }

  // On create success → navigate to new employee profile
  useEffect(() => {
    if (state && (state as { success: boolean; data?: { id: string } }).success && !employee) {
      router.push(`/employees/${(state as { data: { id: string } }).data.id}`);
    }
  }, [state, router, employee]);

  // On edit success → callback (e.g. close edit panel) or show toast
  const [showToast, setShowToast] = useState(false);
  useEffect(() => {
    if (state && (state as { success: boolean }).success && !!employee) {
      if (onSaveSuccess) {
        onSaveSuccess();
      } else {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShowToast(true);
        const t = setTimeout(() => setShowToast(false), 4000);
        return () => clearTimeout(t);
      }
    }
  }, [state, employee, onSaveSuccess]);

  const errorMessage =
    state && !(state as { success: boolean }).success
      ? (state as { error: { message: string } }).error.message
      : null;

  const isEdit = !!employee;
  const currentEmploymentType = employee?.employmentType ?? "";

  return (
    <div className="space-y-5">
      {showToast && (
        <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          {tC("save")}
        </div>
      )}
      {errorMessage && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {errorMessage}
        </div>
      )}

      <form id={EMPLOYEE_FORM_ID} action={formAction} className="space-y-5">
        <p className="text-xs text-ink-900/50"><span className="text-red-500">*</span> {t("form.requiredFieldsNote")}</p>

        {/* ── Section 1: Personal Information ──────────────────────────── */}
        <Card className="p-6">
          <SectionHeader icon={User} title={t("form.personalInfo")} />
          <div className="space-y-5">
            <PhotoInput
              name="photo"
              currentName={`${employee?.firstName ?? ""} ${employee?.lastName ?? ""}`}
              currentUrl={employee?.profileImageUrl}
            />

            {isEdit && employee.employeeId && (
              <div className="rounded-lg border border-ink-900/10 bg-sand-100 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-900/45">{t("overview.employeeId")}</p>
                <p className="mt-1 text-sm font-medium text-ink-900">{employee.employeeId}</p>
              </div>
            )}
            {!isEdit && (
              <div className="rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-800">
                {t("inPreboardingChecklist")}
              </div>
            )}

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FieldGroup>
                <Label htmlFor="firstName">{t("form.firstName")}<RequiredMark /></Label>
                <Input id="firstName" name="firstName" required defaultValue={employee?.firstName ?? ""} />
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="middleName">{t("form.middleName")}<RequiredMark /></Label>
                <Input id="middleName" name="middleName" required defaultValue={employee?.middleName ?? ""} />
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="lastName">{t("form.lastName")}<RequiredMark /></Label>
                <Input id="lastName" name="lastName" required defaultValue={employee?.lastName ?? ""} />
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="gender">{t("form.gender")}<RequiredMark /></Label>
                <Select id="gender" name="gender" defaultValue={employee?.gender ?? ""}>
                  <option value="">{t("form.selectGender")}</option>
                  <option value="MALE">{t("form.genderMale")}</option>
                  <option value="FEMALE">{t("form.genderFemale")}</option>
                </Select>
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="dateOfBirth">{t("form.dateOfBirth")}<RequiredMark /></Label>
                <Input id="dateOfBirth" name="dateOfBirth" type="date" required max={maxDob} defaultValue={toDateInputValue(employee?.dateOfBirth)} onChange={(e) => validateDob(e.target.value)} />
                {dobError && <FieldError>{dobError}</FieldError>}
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="maritalStatus">{t("form.maritalStatus")}<RequiredMark /></Label>
                <Select id="maritalStatus" name="maritalStatus" defaultValue={employee?.maritalStatus ?? ""}>
                  <option value="">{t("form.selectMaritalStatus")}</option>
                  <option value="SINGLE">{t("form.maritalSingle")}</option>
                  <option value="MARRIED">{t("form.maritalMarried")}</option>
                  <option value="DIVORCED">{t("form.maritalDivorced")}</option>
                  <option value="WIDOWED">{t("form.maritalWidowed")}</option>
                  <option value="OTHER">{t("form.maritalOther")}</option>
                </Select>
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="phone">{t("form.phone")}<RequiredMark /></Label>
                <PhoneInput name="phone" defaultValue={employee?.phone} required />
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="email">{t("overview.email")}</Label>
                <Input id="email" name="email" type="email" defaultValue={employee?.email ?? ""} />
              </FieldGroup>
            </div>
            <FieldGroup>
              <Label htmlFor="address">{t("form.address")}</Label>
              <Textarea id="address" name="address" rows={2} defaultValue={employee?.address ?? ""} />
            </FieldGroup>
          </div>
        </Card>

        {/* ── Section 2: Employment Information ────────────────────────── */}
        <Card className="p-6">
          <SectionHeader icon={Briefcase} title={t("form.employmentDetails")} />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

            {isEdit ? (
              <>
                <FieldGroup>
                  <Label htmlFor="departmentId">{t("form.department")}</Label>
                  <Select id="departmentId" value={selectedDeptId} disabled onChange={() => {}}>
                    <option value={selectedDeptId}>{departments.find((d) => d.id === selectedDeptId)?.name ?? tC("na")}</option>
                  </Select>
                  <input type="hidden" name="departmentId" value={selectedDeptId} />
                </FieldGroup>
                <FieldGroup>
                  <Label htmlFor="positionId">{t("form.position")}</Label>
                  <Select id="positionId" value={selectedPosId} disabled onChange={() => {}}>
                    <option value={selectedPosId}>{positions.find((p) => p.id === selectedPosId)?.name ?? tC("na")}</option>
                  </Select>
                  <input type="hidden" name="positionId" value={selectedPosId} />
                </FieldGroup>
                <FieldGroup>
                  <Label htmlFor="employmentType">{t("form.employmentType")}</Label>
                  <Select id="employmentType" value={employee?.employmentType ?? ""} disabled onChange={() => {}}>
                    <option value={employee?.employmentType ?? ""}>{employee?.employmentType ? t(`types.${employee.employmentType as "PERMANENT"|"CONTRACT"|"TEMPORARY"|"PROBATION"|"INTERNSHIP"}`) : tC("notSet")}</option>
                  </Select>
                  <input type="hidden" name="employmentType" value={employee?.employmentType ?? ""} />
                </FieldGroup>
              </>
            ) : (
              <>
                <FieldGroup>
                  <Label htmlFor="departmentId">{t("form.department")}<RequiredMark /></Label>
                  <Select id="departmentId" name="departmentId" required value={selectedDeptId} onChange={handleDeptChange}>
                    <option value="">{t("form.selectDepartment")}</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </Select>
                </FieldGroup>

                <FieldGroup>
                  <Label htmlFor="positionId">{t("form.position")}<RequiredMark /></Label>
                  <Select id="positionId" name="positionId" required value={selectedPosId} onChange={(e) => setSelectedPosId(e.target.value)} disabled={!selectedDeptId}>
                    <option value="">{selectedDeptId ? t("form.selectPosition") : t("form.selectDepartmentFirst")}</option>
                    {filteredPositions.map((p) => {
                      const isManagerTypeName = p.name.toLowerCase().includes("manager");
                      const shouldDisable = p.isManagerPosition || (isManagerTypeName && p.departmentHasManager);
                      return (
                        <option key={p.id} value={p.id} disabled={shouldDisable}>
                          {p.name}{p.isManagerPosition ? ` — ${t("form.positionTakenByManager")}` : (isManagerTypeName && p.departmentHasManager ? ` — ${t("form.positionTakenByManager")}` : "")}
                        </option>
                      );
                    })}
                  </Select>
                  {selectedDeptId && filteredPositions.length === 0 && (
                    <p className="mt-1 text-xs text-ink-900/50">{t("form.noPositionsInDept")}</p>
                  )}
                  {selectedDeptId && filteredPositions.some((p) => p.isManagerPosition) && (
                    <p className="mt-1 text-xs text-amber-700">
                      {t("form.deptHasManagerPositionHint")}
                    </p>
                  )}
                  {selectedDeptId && !filteredPositions.some((p) => p.isManagerPosition) && filteredPositions.some((p) => p.departmentHasManager && p.name.toLowerCase().includes("manager")) && (
                    <p className="mt-1 text-xs text-amber-700">
                      {t("form.deptManagerSlotTaken")}
                    </p>
                  )}
                </FieldGroup>

                <FieldGroup>
                  <Label htmlFor="employmentType">{t("form.employmentType")}<RequiredMark /></Label>
                  <Select id="employmentType" name="employmentType" defaultValue={currentEmploymentType}>
                    <option value="">{t("form.selectEmploymentType")}</option>
                    {(["PERMANENT","CONTRACT","TEMPORARY","PROBATION","INTERNSHIP"] as const).map((v) => (
                      <option key={v} value={v}>{t(`types.${v}`)}</option>
                    ))}
                  </Select>
                </FieldGroup>
              </>
            )}

            <FieldGroup>
              <Label htmlFor="hireDate">{t("form.hireDate")}<RequiredMark /></Label>
              <Input id="hireDate" name="hireDate" type="date" required defaultValue={toDateInputValue(employee?.hireDate)} />
            </FieldGroup>

            {isEdit && (
              <FieldGroup>
                <Label htmlFor="employmentStatus">{tC("status")}</Label>
                <Select id="employmentStatus" name="employmentStatus" defaultValue={employee?.employmentStatus ?? "ONBOARDING"}>
                  {["ONBOARDING","ACTIVE","RESIGNED","RETIRED","TERMINATED","INACTIVE"].includes(employee?.employmentStatus ?? "") && (
                    <option value={employee?.employmentStatus ?? "ONBOARDING"} disabled>
                      {t(`statuses.${(employee?.employmentStatus ?? "ONBOARDING") as "ONBOARDING"|"ACTIVE"|"RESIGNED"|"RETIRED"|"TERMINATED"|"INACTIVE"}`)}
                    </option>
                  )}
                  <option value="ON_LEAVE">{t("statuses.ON_LEAVE")}</option>
                  <option value="SUSPENDED">{t("statuses.SUSPENDED")}</option>
                </Select>
              </FieldGroup>
            )}

            {/* Hidden status for create — server always enforces ONBOARDING */}
            {!isEdit && (
              <input type="hidden" name="employmentStatus" value="ONBOARDING" />
            )}

            <FieldGroup className="sm:col-span-2">
              <Label htmlFor="managerId">{t("form.manager")}<RequiredMark /></Label>
              {!isEdit && departmentsWithManagers ? (
                (() => {
                  const selectedDeptManager = selectedDeptId
                    ? (departmentsWithManagers.find((d) => d.id === selectedDeptId)?.manager ?? null)
                    : null;
                  if (!selectedDeptId) {
                    // No department chosen yet — show disabled combobox placeholder
                    return (
                      <>
                        <input type="hidden" name="managerId" value="" />
                        <div className="rounded-lg border border-ink-900/15 bg-sand-50 px-3 py-2.5 text-sm text-ink-900/40">
                          {t("form.selectDepartmentFirst")}
                        </div>
                      </>
                    );
                  }
                  if (selectedDeptManager) {
                    return (
                      <>
                        <input type="hidden" name="managerId" value={selectedDeptManager.id} />
                        <div className="rounded-lg border border-ink-900/10 bg-sand-50 px-3 py-2.5">
                          <p className="text-sm font-medium text-ink-900">
                            {selectedDeptManager.firstName} {selectedDeptManager.lastName}
                          </p>
                          <p className="text-xs text-ink-900/45">
                            {selectedDeptManager.employeeId}
                            {selectedDeptManager.position?.name ? ` · ${selectedDeptManager.position.name}` : ""}
                          </p>
                          <p className="mt-1 text-xs text-ink-900/50">{t("form.managerAutoAssigned")}</p>
                        </div>
                      </>
                    );
                  }
                  // Department selected but no manager assigned
                  return (
                    <>
                      <input type="hidden" name="managerId" value="" />
                      <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                        {t("form.noDeptManagerWarning")}
                      </div>
                    </>
                  );
                })()
              ) : (
                <ManagerCombobox managers={managers} defaultValue={employee?.managerId} name="managerId" required />
              )}
            </FieldGroup>
          </div>
        </Card>

        {/* ── Section 3: Emergency Contact ─────────────────────────────── */}
        <Card className="p-6">
          <SectionHeader icon={Phone} title={t("form.emergencyContact")} />

          {/* ── 3a: Primary Contact ────────────────────────────────────── */}
          <div className="mb-6">
            <h4 className="mb-4 text-sm font-semibold text-ink-900/70">{t("form.primaryContact")}</h4>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FieldGroup>
                <Label htmlFor="emergencyContactName">{t("form.emergencyContactName")}<RequiredMark /></Label>
                <Input id="emergencyContactName" name="emergencyContactName" required maxLength={100} defaultValue={employee?.emergencyContactName ?? ""} />
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="emergencyContactRelationship">{t("form.emergencyContactRelationship")}<RequiredMark /></Label>
                <RelationshipSelect defaultValue={employee?.emergencyContactRelationship} name="emergencyContactRelationship" />
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="emergencyContactPhone">{t("form.emergencyContactPhone")}<RequiredMark /></Label>
                <PhoneInput name="emergencyContactPhone" defaultValue={employee?.emergencyContactPhone} required />
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="emergencyContactAltPhone">
                  {t("form.emergencyContactAltPhone")} <span className="text-xs font-normal text-ink-900/40">({t("form.optional")})</span>
                </Label>
                <PhoneInput name="emergencyContactAltPhone" defaultValue={employee?.emergencyContactAltPhone} />
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="emergencyContactEmail">
                  {t("form.emergencyContactEmail")} <span className="text-xs font-normal text-ink-900/40">({t("form.optional")})</span>
                </Label>
                <Input id="emergencyContactEmail" name="emergencyContactEmail" type="email" defaultValue={employee?.emergencyContactEmail ?? ""} />
              </FieldGroup>
            </div>
          </div>

          {/* ── 3b: Contact Address ────────────────────────────────────── */}
          <div className="mb-6 border-t border-ink-900/8 pt-5">
            <h4 className="mb-4 text-sm font-semibold text-ink-900/70">{t("form.contactAddress")}</h4>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FieldGroup className="sm:col-span-2">
                <Label htmlFor="emergencyContactAddress">
                  {t("form.emergencyContactAddress")} <span className="text-xs font-normal text-ink-900/40">({t("form.optional")})</span>
                </Label>
                <Input id="emergencyContactAddress" name="emergencyContactAddress" defaultValue={employee?.emergencyContactAddress ?? ""} />
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="emergencyContactAddressCity">
                  {t("form.city")} <span className="text-xs font-normal text-ink-900/40">({t("form.optional")})</span>
                </Label>
                <Input id="emergencyContactAddressCity" name="emergencyContactAddressCity" maxLength={100} defaultValue={employee?.emergencyContactAddressCity ?? ""} />
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="emergencyContactAddressRegion">
                  {t("form.region")} <span className="text-xs font-normal text-ink-900/40">({t("form.optional")})</span>
                </Label>
                <Input id="emergencyContactAddressRegion" name="emergencyContactAddressRegion" maxLength={100} defaultValue={employee?.emergencyContactAddressRegion ?? ""} />
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="emergencyContactAddressPostalCode">
                  {t("form.postalCode")} <span className="text-xs font-normal text-ink-900/40">({t("form.optional")})</span>
                </Label>
                <Input id="emergencyContactAddressPostalCode" name="emergencyContactAddressPostalCode" maxLength={20} defaultValue={employee?.emergencyContactAddressPostalCode ?? ""} />
              </FieldGroup>
            </div>
          </div>

          {/* ── 3c: Secondary Contact ──────────────────────────────────── */}
          <div className="mb-6 border-t border-ink-900/8 pt-5">
            <h4 className="mb-4 text-sm font-semibold text-ink-900/70">{t("form.secondaryContact")} <span className="text-xs font-normal text-ink-900/40">({t("form.optional")})</span></h4>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FieldGroup>
                <Label htmlFor="emergencyContact2Name">
                  {t("form.secondaryContactName")} <span className="text-xs font-normal text-ink-900/40">({t("form.optional")})</span>
                </Label>
                <Input id="emergencyContact2Name" name="emergencyContact2Name" maxLength={100} defaultValue={employee?.emergencyContact2Name ?? ""} />
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="emergencyContact2Relationship">
                  {t("form.secondaryContactRelationship")} <span className="text-xs font-normal text-ink-900/40">({t("form.optional")})</span>
                </Label>
                <RelationshipSelect defaultValue={employee?.emergencyContact2Relationship} name="emergencyContact2Relationship" />
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="emergencyContact2Phone">
                  {t("form.secondaryContactPhone")} <span className="text-xs font-normal text-ink-900/40">({t("form.optional")})</span>
                </Label>
                <PhoneInput name="emergencyContact2Phone" defaultValue={employee?.emergencyContact2Phone} />
              </FieldGroup>
            </div>
          </div>

          {/* ── 3d: Consent & Authorization ───────────────────────────── */}
          <div className="border-t border-ink-900/8 pt-5">
            <h4 className="mb-4 text-sm font-semibold text-ink-900/70">{t("form.consentTitle")}</h4>
            <FieldGroup>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="emergencyContactConsentRecorded"
                  value="true"
                  defaultChecked={employee?.emergencyContactConsentRecorded === true}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border border-ink-900/25 accent-brand-700 focus:ring-2 focus:ring-brand-600/20"
                />
                <span className="text-sm text-ink-900/80">{t("form.consentCheckboxLabel")}</span>
              </label>
              <p className="mt-2 text-xs text-ink-900/45">{t("form.consentNote")}</p>
              {state && !(state as { success: boolean }).success &&
                (state as { error?: { message: string } }).error?.message?.includes("consent") && (
                <FieldError>{t("form.consentRequired")}</FieldError>
              )}
            </FieldGroup>
          </div>
        </Card>

        {/* ── Section 4: Education ─────────────────────────────────────── */}
        <Card className="p-6">
          {/* SectionHeader is rendered here (outside the dynamic boundary) so
              Turbopack never needs to statically resolve GraduationCap from the
              dynamically-loaded education-section bundle. */}
          <SectionHeader icon={GraduationCap} title={t("education.title")} />
          <EducationSection initialRecords={employee?.educations ?? []} />
        </Card>

      </form>
      <div className="sticky bottom-0 z-10 border-t border-ink-900/8 bg-white px-4 py-3 shadow-[0_-1px_3px_rgba(0,0,0,0.04)]">
        <EmployeeFormActions isEdit={isEdit} isPending={isPending} onCancel={onSaveSuccess} />
      </div>
    </div>
  );
}
