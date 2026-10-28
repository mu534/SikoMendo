"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { User, Briefcase, Phone, Search, GraduationCap } from "lucide-react";
import { Input, Label, Select, Textarea, FieldGroup } from "@/components/ui/field";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PhotoInput } from "./photo-input";
import { SectionHeader } from "./section-header";
import type { EducationRecordInput } from "./schemas";
import { EMERGENCY_CONTACT_RELATIONSHIPS } from "./schemas";

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

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  PERMANENT:  "Permanent",
  CONTRACT:   "Contract",
  TEMPORARY:  "Temporary",
  PROBATION:  "Probation",
  INTERNSHIP: "Internship",
};

type EmploymentStatus =
  | "ONBOARDING" | "ACTIVE" | "ON_LEAVE" | "RESIGNED" | "RETIRED"
  | "SUSPENDED" | "TERMINATED" | "INACTIVE";

export type DepartmentOption = { id: string; name: string };
export type PositionOption   = { id: string; name: string; departmentId: string };
export type ManagerOption    = {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  position?: { name: string } | null;
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

  const filtered =
    query.trim() === ""
      ? managers.slice(0, 12)
      : managers.filter((m) => {
          const full = `${m.firstName} ${m.lastName} ${m.employeeId}`.toLowerCase();
          return full.includes(query.toLowerCase());
        }).slice(0, 12);

  return (
    <div className="relative">
      {/* Hidden input for form submission */}
      <input type="hidden" name={name} value={selected?.id ?? ""} />

      {/* Trigger / search input */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-900/35"
          aria-hidden="true"
        />
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label="Search manager"
          placeholder={selected ? `${selected.firstName} ${selected.lastName}` : "Search by name or ID…"}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="w-full rounded-lg border border-ink-900/15 bg-white py-2 pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-900/35 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
        />
      </div>

      {/* Currently selected — shown below input when closed */}
      {selected && !open && (
        <div className="mt-1.5 flex items-center justify-between rounded-lg border border-ink-900/8 bg-sand-50 px-3 py-2">
          <div>
            <p className="text-sm font-medium text-ink-900">
              {selected.firstName} {selected.lastName}
            </p>
            <p className="text-xs text-ink-900/45">
              {selected.employeeId}
              {selected.position?.name ? ` · ${selected.position.name}` : ""}
            </p>
          </div>
          {!required && (
            <button
              type="button"
              onClick={() => { setSelected(null); setQuery(""); }}
              className="text-xs font-medium text-ink-900/40 hover:text-ink-900"
              aria-label="Remove manager selection"
            >
              Remove
            </button>
          )}
        </div>
      )}

      {/* Dropdown list */}
      {open && (
        <ul
          role="listbox"
          aria-label="Manager options"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-ink-900/10 bg-white py-1 shadow-lg shadow-ink-900/8"
        >
          {!required && (
            <li
              role="option"
              aria-selected={!selected}
              onMouseDown={() => { setSelected(null); setQuery(""); setOpen(false); }}
              className="cursor-pointer px-3 py-2 text-sm text-ink-900/45 hover:bg-sand-50"
            >
              — No manager —
            </li>
          )}
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-ink-900/40">No employees found.</li>
          )}
          {filtered.map((m) => (
            <li
              key={m.id}
              role="option"
              aria-selected={selected?.id === m.id}
              onMouseDown={() => { setSelected(m); setQuery(""); setOpen(false); }}
              className={`cursor-pointer px-3 py-2.5 hover:bg-sand-50 ${
                selected?.id === m.id ? "bg-brand-50" : ""
              }`}
            >
              <p className="text-sm font-medium text-ink-900">
                {m.firstName} {m.lastName}
              </p>
              <p className="text-xs text-ink-900/45">
                {m.employeeId}
                {m.position?.name ? ` · ${m.position.name}` : ""}
              </p>
            </li>
          ))}
          {managers.length > 12 && filtered.length === 12 && (
            <li className="px-3 py-1.5 text-xs text-ink-900/35">
              Type to narrow results…
            </li>
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
}: {
  defaultValue?: string | null;
}) {
  // A stored value is "custom Other" if it is non-empty AND not one of the
  // named options (including the sentinel itself, which is never persisted).
  const namedOptions = new Set<string>(EMERGENCY_CONTACT_RELATIONSHIPS);
  const isStoredOther = !!defaultValue && !namedOptions.has(defaultValue);

  const [selected, setSelected] = useState<string>(
    isStoredOther ? OTHER_SENTINEL : (defaultValue ?? "")
  );
  const [customText, setCustomText] = useState<string>(
    isStoredOther ? (defaultValue ?? "") : ""
  );

  const isOther = selected === OTHER_SENTINEL;
  // The resolved value that goes into the hidden input (and therefore the DB).
  const resolvedValue = isOther ? customText.trim() : selected;

  return (
    <>
      {/* Hidden input carries the resolved relationship value */}
      <input type="hidden" name="emergencyContactRelationship" value={resolvedValue} />

      {/* Visible dropdown */}
      <div className="relative">
        <Select
          id="emergencyContactRelationship"
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            if (e.target.value !== OTHER_SENTINEL) setCustomText("");
          }}
        >
          <option value="">Select relationship…</option>
          {EMERGENCY_CONTACT_RELATIONSHIPS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </Select>
      </div>

      {/* "Specify" text input — shown only when "Other" is selected */}
      {isOther && (
        <FieldGroup className="mt-3">
          <Label htmlFor="emergencyContactRelationshipOther">
            Specify Relationship<RequiredMark />
          </Label>
          <Input
            id="emergencyContactRelationshipOther"
            placeholder="Describe the relationship"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            required
          />
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
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-ink-900/8 pt-4">
      <Button type="submit" form={EMPLOYEE_FORM_ID} disabled={isPending}>
        {isPending ? (
          <span className="flex items-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Saving…
          </span>
        ) : isEdit ? "Save changes" : "Create employee"}
      </Button>
      {isEdit && onCancel ? (
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      ) : isEdit ? (
        <Button type="reset" form={EMPLOYEE_FORM_ID} variant="outline">Reset</Button>
      ) : (
        <>
          <Button type="reset" form={EMPLOYEE_FORM_ID} variant="outline">Reset</Button>
          <ButtonLink href="/employees" variant="ghost">Cancel</ButtonLink>
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
  onSaveSuccess?: () => void;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(action, null);

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
    <div className="max-w-3xl space-y-5">
      {showToast && (
        <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          Employee record updated successfully.
        </div>
      )}
      {errorMessage && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {errorMessage}
        </div>
      )}

      <form id={EMPLOYEE_FORM_ID} action={formAction} className="space-y-5">

        {/* ── Section 1: Personal Information ──────────────────────────── */}
        <Card className="p-6">
          <SectionHeader icon={User} title="Personal Information" />
          <div className="space-y-5">
            <PhotoInput
              name="photo"
              currentName={`${employee?.firstName ?? ""} ${employee?.lastName ?? ""}`}
              currentUrl={employee?.profileImageUrl}
            />

            {isEdit && employee.employeeId && (
              <div className="rounded-lg border border-ink-900/10 bg-sand-100 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-900/45">Employee ID</p>
                <p className="mt-1 text-sm font-medium text-ink-900">{employee.employeeId}</p>
                <p className="mt-0.5 text-xs text-ink-900/45">Automatically assigned — cannot be changed.</p>
              </div>
            )}
            {!isEdit && (
              <div className="rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-800">
                Employee ID will be automatically assigned on save (e.g. EMP-0008).
              </div>
            )}

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FieldGroup>
                <Label htmlFor="firstName">First Name (Given Name)<RequiredMark /></Label>
                <Input id="firstName" name="firstName" required defaultValue={employee?.firstName ?? ""} />
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="middleName">Father&apos;s Name<RequiredMark /></Label>
                <Input id="middleName" name="middleName" required defaultValue={employee?.middleName ?? ""} />
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="lastName">Grandfather&apos;s Name<RequiredMark /></Label>
                <Input id="lastName" name="lastName" required defaultValue={employee?.lastName ?? ""} />
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="gender">Gender<RequiredMark /></Label>
                <Select id="gender" name="gender" defaultValue={employee?.gender ?? ""}>
                  <option value="">Select gender…</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </Select>
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="dateOfBirth">Date of Birth<RequiredMark /></Label>
                <Input id="dateOfBirth" name="dateOfBirth" type="date" required defaultValue={toDateInputValue(employee?.dateOfBirth)} />
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="maritalStatus">Marital Status<RequiredMark /></Label>
                <Select id="maritalStatus" name="maritalStatus" defaultValue={employee?.maritalStatus ?? ""}>
                  <option value="">Select status…</option>
                  <option value="SINGLE">Single</option>
                  <option value="MARRIED">Married</option>
                  <option value="DIVORCED">Divorced</option>
                  <option value="WIDOWED">Widowed</option>
                </Select>
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="phone">Phone Number<RequiredMark /></Label>
                <Input id="phone" name="phone" required placeholder="+251 9XX XXX XXX" defaultValue={employee?.phone ?? ""} />
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" name="email" type="email" defaultValue={employee?.email ?? ""} />
              </FieldGroup>
            </div>
            <FieldGroup>
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" name="address" rows={2} defaultValue={employee?.address ?? ""} />
            </FieldGroup>
          </div>
        </Card>

        {/* ── Section 2: Employment Information ────────────────────────── */}
        <Card className="p-6">
          <SectionHeader icon={Briefcase} title="Employment Information" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

            {isEdit ? (
              <>
                {/* Locked on edit — changes go through Employment History */}
                <FieldGroup>
                  <Label htmlFor="departmentId">Department</Label>
                  <Select id="departmentId" value={selectedDeptId} disabled onChange={() => {}}>
                    <option value={selectedDeptId}>
                      {departments.find((d) => d.id === selectedDeptId)?.name ?? "—"}
                    </option>
                  </Select>
                  <input type="hidden" name="departmentId" value={selectedDeptId} />
                </FieldGroup>
                <FieldGroup>
                  <Label htmlFor="positionId">Position</Label>
                  <Select id="positionId" value={selectedPosId} disabled onChange={() => {}}>
                    <option value={selectedPosId}>
                      {positions.find((p) => p.id === selectedPosId)?.name ?? "—"}
                    </option>
                  </Select>
                  <input type="hidden" name="positionId" value={selectedPosId} />
                </FieldGroup>
                <FieldGroup>
                  <Label htmlFor="employmentType">Employment Type</Label>
                  <Select id="employmentType" value={employee?.employmentType ?? ""} disabled onChange={() => {}}>
                    <option value={employee?.employmentType ?? ""}>
                      {EMPLOYMENT_TYPE_LABELS[employee?.employmentType ?? ""] ?? "Not specified"}
                    </option>
                  </Select>
                  <input type="hidden" name="employmentType" value={employee?.employmentType ?? ""} />
                  <p className="mt-1 text-xs text-ink-900/50">
                    Use <span className="font-medium">Record Employment Change</span> to update
                    department, position, or type.
                  </p>
                </FieldGroup>
              </>
            ) : (
              <>
                <FieldGroup>
                  <Label htmlFor="departmentId">Department<RequiredMark /></Label>
                  <Select
                    id="departmentId"
                    name="departmentId"
                    required
                    value={selectedDeptId}
                    onChange={handleDeptChange}
                  >
                    <option value="">Select department…</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </Select>
                </FieldGroup>

                <FieldGroup>
                  <Label htmlFor="positionId">Position<RequiredMark /></Label>
                  <Select
                    id="positionId"
                    name="positionId"
                    required
                    value={selectedPosId}
                    onChange={(e) => setSelectedPosId(e.target.value)}
                    disabled={!selectedDeptId}
                  >
                    <option value="">
                      {selectedDeptId ? "Select position…" : "Select a department first"}
                    </option>
                    {filteredPositions.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </Select>
                  {selectedDeptId && filteredPositions.length === 0 && (
                    <p className="mt-1 text-xs text-ink-900/50">
                      No active positions in this department.
                    </p>
                  )}
                </FieldGroup>

                <FieldGroup>
                  <Label htmlFor="employmentType">Employment Type<RequiredMark /></Label>
                  <Select id="employmentType" name="employmentType" defaultValue={currentEmploymentType}>
                    <option value="">Select type…</option>
                    <option value="PERMANENT">Permanent</option>
                    <option value="CONTRACT">Contract</option>
                    <option value="TEMPORARY">Temporary</option>
                    <option value="PROBATION">Probation</option>
                    <option value="INTERNSHIP">Internship</option>
                  </Select>
                </FieldGroup>
              </>
            )}

            <FieldGroup>
              <Label htmlFor="hireDate">Hire Date<RequiredMark /></Label>
              <Input
                id="hireDate"
                name="hireDate"
                type="date"
                required
                defaultValue={toDateInputValue(employee?.hireDate)}
              />
            </FieldGroup>

            {/*
              Employment Status: only shown in EDIT mode, and only for
              administrative adjustments (ON_LEAVE, SUSPENDED).
              New employees always start in ONBOARDING (server-enforced).
              Lifecycle transitions (ACTIVE, RESIGNED, TERMINATED, etc.)
              are controlled by lifecycle workflows — not this form.
            */}
            {isEdit && (
              <FieldGroup>
                <Label htmlFor="employmentStatus">Administrative Status</Label>
                <Select
                  id="employmentStatus"
                  name="employmentStatus"
                  defaultValue={employee?.employmentStatus ?? "ONBOARDING"}
                >
                  {/* Show current value if it's lifecycle-controlled (read-only display) */}
                  {["ONBOARDING","ACTIVE","RESIGNED","RETIRED","TERMINATED","INACTIVE"].includes(
                    employee?.employmentStatus ?? ""
                  ) && (
                    <option value={employee?.employmentStatus ?? "ONBOARDING"} disabled>
                      {(employee?.employmentStatus ?? "ONBOARDING").replace(/_/g, " ")} (set by lifecycle)
                    </option>
                  )}
                  <option value="ON_LEAVE">On Leave</option>
                  <option value="SUSPENDED">Suspended</option>
                </Select>
                <p className="mt-1 text-xs text-ink-900/45">
                  Only administrative adjustments (On Leave, Suspended) can be set here. Use the{" "}
                  <span className="font-medium">Lifecycle</span> tab for onboarding, offboarding, and
                  other status transitions.
                </p>
              </FieldGroup>
            )}

            {/* Hidden status for create — server always enforces ONBOARDING */}
            {!isEdit && (
              <input type="hidden" name="employmentStatus" value="ONBOARDING" />
            )}

            {/* Manager / Reports-to — searchable combobox */}
            <FieldGroup className="sm:col-span-2">
              <Label htmlFor="managerId">Reports To (Manager)<RequiredMark /></Label>
              <ManagerCombobox
                managers={managers}
                defaultValue={employee?.managerId}
                name="managerId"
                required
              />
            </FieldGroup>
          </div>
        </Card>

        {/* ── Section 3: Emergency Contact ─────────────────────────────── */}
        <Card className="p-6">
          <SectionHeader icon={Phone} title="Emergency Contact" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FieldGroup>
              <Label htmlFor="emergencyContactName">Contact Name<RequiredMark /></Label>
              <Input
                id="emergencyContactName"
                name="emergencyContactName"
                required
                maxLength={100}
                placeholder="Full name"
                defaultValue={employee?.emergencyContactName ?? ""}
              />
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="emergencyContactRelationship">Relationship<RequiredMark /></Label>
              <RelationshipSelect defaultValue={employee?.emergencyContactRelationship} />
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="emergencyContactPhone">Phone Number<RequiredMark /></Label>
              <Input
                id="emergencyContactPhone"
                name="emergencyContactPhone"
                required
                placeholder="+251 9XX XXX XXX"
                defaultValue={employee?.emergencyContactPhone ?? ""}
              />
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="emergencyContactAddress">Address <span className="text-xs font-normal text-ink-900/40">(optional)</span></Label>
              <Input
                id="emergencyContactAddress"
                name="emergencyContactAddress"
                defaultValue={employee?.emergencyContactAddress ?? ""}
              />
            </FieldGroup>
          </div>
        </Card>

        {/* ── Section 4: Education ─────────────────────────────────────── */}
        <Card className="p-6">
          {/* SectionHeader is rendered here (outside the dynamic boundary) so
              Turbopack never needs to statically resolve GraduationCap from the
              dynamically-loaded education-section bundle. */}
          <SectionHeader icon={GraduationCap} title="Education" />
          <EducationSection initialRecords={employee?.educations ?? []} />
        </Card>

      </form>
      <EmployeeFormActions isEdit={isEdit} isPending={isPending} onCancel={onSaveSuccess} />
    </div>
  );
}
