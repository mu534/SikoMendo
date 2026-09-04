"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Briefcase, GraduationCap, Phone } from "lucide-react";
import { Input, Label, Select, Textarea, FieldGroup } from "@/components/ui/field";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PhotoInput } from "./photo-input";
import { SectionHeader } from "./section-header";

export { SectionHeader } from "./section-header";

export const EMPLOYEE_FORM_ID = "employee-form";

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  PERMANENT: "Permanent",
  CONTRACT: "Contract",
  TEMPORARY: "Temporary",
  PROBATION: "Probation",
  INTERNSHIP: "Internship",
};

type EmploymentStatus =
  | "ACTIVE" | "ON_LEAVE" | "RESIGNED" | "RETIRED"
  | "SUSPENDED" | "TERMINATED" | "INACTIVE";

export type DepartmentOption = { id: string; name: string };
export type PositionOption  = { id: string; name: string; departmentId: string };
export type ManagerOption   = { id: string; firstName: string; lastName: string; employeeId: string };

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
  // FK-based fields
  departmentId?: string | null;
  positionId?: string | null;
  managerId?: string | null;
  employmentType?: string | null;
  hireDate?: string | null;
  employmentStatus: EmploymentStatus;
  educationLevel?: string | null;
  fieldOfStudy?: string | null;
  institutionName?: string | null;
  graduationYear?: string | null;
  profileImageUrl?: string | null;
};

function toDateInputValue(date?: string | null) {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

function RequiredMark() {
  return <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>;
}

export function EmployeeFormActions({
  isPending,
  isEdit,
}: {
  isPending?: boolean;
  isEdit?: boolean;
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
      <Button type="reset" form={EMPLOYEE_FORM_ID} variant="outline">Reset</Button>
      <ButtonLink href="/employees" variant="ghost">Cancel</ButtonLink>
    </div>
  );
}

export function EmployeeForm({
  action,
  employee,
  departments = [],
  positions = [],
  managers = [],
}: {
  action: (prevState: unknown, formData: FormData) => Promise<unknown>;
  employee?: EmployeeFormValues;
  departments?: DepartmentOption[];
  positions?: PositionOption[];
  managers?: ManagerOption[];
}) {
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [state, formAction, isPending] = useActionState(action as any, null);

  // Cascading department→position filter
  const [selectedDeptId, setSelectedDeptId] = useState(employee?.departmentId ?? "");
  const filteredPositions = selectedDeptId
    ? positions.filter((p) => p.departmentId === selectedDeptId)
    : positions;

  // When the department changes, clear the position selection unless it belongs to the new dept
  const [selectedPosId, setSelectedPosId] = useState(employee?.positionId ?? "");
  const [selectedManagerId, setSelectedManagerId] = useState(employee?.managerId ?? "");
  function handleDeptChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedDeptId(e.target.value);
    setSelectedPosId(""); // reset position when dept changes
  }

  useEffect(() => {
    if (state && (state as { success: boolean; data?: { id: string } }).success && !employee) {
      router.push(`/employees/${(state as { data: { id: string } }).data.id}`);
    }
  }, [state, router, employee]);

  const [showToast, setShowToast] = useState(false);
  useEffect(() => {
    if (state && (state as { success: boolean }).success && !!employee) {
      // Reacting to a useActionState result changing (an external system) —
      // not a derived-state anti-pattern.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowToast(true);
      const t = setTimeout(() => setShowToast(false), 4000);
      return () => clearTimeout(t);
    }
  }, [state, employee]);

  const errorMessage =
    state && !(state as { success: boolean }).success
      ? (state as { error: { message: string } }).error.message
      : null;

  const isEdit = !!employee;
  // Extract employmentType before JSX so TypeScript doesn't narrow employee to never
  // inside the !isEdit branch (where employee is undefined).
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
                <Label htmlFor="firstName">First Name<RequiredMark /></Label>
                <Input id="firstName" name="firstName" required defaultValue={employee?.firstName ?? ""} />
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="middleName">Middle Name</Label>
                <Input id="middleName" name="middleName" defaultValue={employee?.middleName ?? ""} />
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="lastName">Last Name<RequiredMark /></Label>
                <Input id="lastName" name="lastName" required defaultValue={employee?.lastName ?? ""} />
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="gender">Gender</Label>
                <Select id="gender" name="gender" defaultValue={employee?.gender ?? ""}>
                  <option value="">Not specified</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </Select>
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={toDateInputValue(employee?.dateOfBirth)} />
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="maritalStatus">Marital Status</Label>
                <Select id="maritalStatus" name="maritalStatus" defaultValue={employee?.maritalStatus ?? ""}>
                  <option value="">Not specified</option>
                  <option value="SINGLE">Single</option>
                  <option value="MARRIED">Married</option>
                  <option value="DIVORCED">Divorced</option>
                  <option value="WIDOWED">Widowed</option>
                </Select>
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" name="phone" placeholder="+251 9XX XXX XXX" defaultValue={employee?.phone ?? ""} />
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

        {/* ── Section 2: Emergency Contact ─────────────────────────────── */}
        <Card className="p-6">
          <SectionHeader icon={Phone} title="Emergency Contact" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FieldGroup>
              <Label htmlFor="emergencyContactName">Contact Name</Label>
              <Input id="emergencyContactName" name="emergencyContactName" defaultValue={employee?.emergencyContactName ?? ""} />
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="emergencyContactRelationship">Relationship</Label>
              <Input id="emergencyContactRelationship" name="emergencyContactRelationship" placeholder="e.g. Spouse, Parent, Sibling" defaultValue={employee?.emergencyContactRelationship ?? ""} />
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="emergencyContactPhone">Phone Number</Label>
              <Input id="emergencyContactPhone" name="emergencyContactPhone" placeholder="+251 9XX XXX XXX" defaultValue={employee?.emergencyContactPhone ?? ""} />
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="emergencyContactAddress">Address (Optional)</Label>
              <Input id="emergencyContactAddress" name="emergencyContactAddress" defaultValue={employee?.emergencyContactAddress ?? ""} />
            </FieldGroup>
          </div>
        </Card>

        {/* ── Section 3: Employment Information ────────────────────────── */}
        <Card className="p-6">
          <SectionHeader icon={Briefcase} title="Employment Information" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

            {/* Department, Position, and Employment Type: on create, pick them
                directly. On edit, they're locked — changing them here would
                bypass EmploymentHistory tracking, so we point to the dedicated
                "Record employment change" flow instead, which keeps history
                accurate. The hidden inputs still submit the current values so
                the rest of the form (name, phone, etc.) can still be saved. */}
            {isEdit ? (
              <>
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
                    Locked. Use <span className="font-medium">Record Employment Change</span> on this
                    employee&apos;s profile to update department, position, or employment type — it keeps
                    their employment history accurate.
                  </p>
                </FieldGroup>
              </>
            ) : (
              <>
                {/* Department — cascades to Position */}
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

                {/* Position — filtered by selected department */}
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
                      No active positions in this department. Ask an Admin to add positions.
                    </p>
                  )}
                </FieldGroup>

                <FieldGroup>
                  <Label htmlFor="employmentType">Employment Type</Label>
                  <Select id="employmentType" name="employmentType" defaultValue={currentEmploymentType}>                    <option value="">Not specified</option>
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
              <Label htmlFor="hireDate">Hire Date</Label>
              <Input id="hireDate" name="hireDate" type="date" defaultValue={toDateInputValue(employee?.hireDate)} />
            </FieldGroup>

            <FieldGroup>
              <Label htmlFor="employmentStatus">Employment Status<RequiredMark /></Label>
              <Select id="employmentStatus" name="employmentStatus" required defaultValue={employee?.employmentStatus ?? "ACTIVE"}>
                <option value="ACTIVE">Active</option>
                <option value="ON_LEAVE">On Leave</option>
                <option value="RESIGNED">Resigned</option>
                <option value="RETIRED">Retired</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="TERMINATED">Terminated</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
            </FieldGroup>

            {/* Manager / Reports-to selector */}
            <FieldGroup className="sm:col-span-2">
              <Label htmlFor="managerId">Reports To (Manager)</Label>
              <Select
                id="managerId"
                name="managerId"
                value={selectedManagerId}
                onChange={(e) => setSelectedManagerId(e.target.value)}
              >
                <option value="">— None —</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.firstName} {m.lastName} ({m.employeeId})
                  </option>
                ))}
              </Select>
            </FieldGroup>
          </div>
        </Card>

        {/* ── Section 4: Education ─────────────────────────────────────── */}
        <Card className="p-6">
          <SectionHeader icon={GraduationCap} title="Education" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FieldGroup>
              <Label htmlFor="educationLevel">Education Level</Label>
              <Select id="educationLevel" name="educationLevel" defaultValue={employee?.educationLevel ?? ""}>
                <option value="">Not specified</option>
                <option value="PRIMARY">Primary</option>
                <option value="SECONDARY">Secondary</option>
                <option value="CERTIFICATE">Certificate</option>
                <option value="DIPLOMA">Diploma</option>
                <option value="BACHELOR">Bachelor&apos;s Degree</option>
                <option value="MASTER">Master&apos;s Degree</option>
                <option value="PHD">PhD</option>
              </Select>
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="fieldOfStudy">Field of Study</Label>
              <Input id="fieldOfStudy" name="fieldOfStudy" defaultValue={employee?.fieldOfStudy ?? ""} />
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="institutionName">Institution Name</Label>
              <Input id="institutionName" name="institutionName" defaultValue={employee?.institutionName ?? ""} />
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="graduationYear">Graduation Year</Label>
              <Input id="graduationYear" name="graduationYear" placeholder="e.g. 2018" defaultValue={employee?.graduationYear ?? ""} />
            </FieldGroup>
          </div>
        </Card>

      </form>
      {!isEdit && <EmployeeFormActions isEdit={false} isPending={isPending} />}
    </div>
  );
}
