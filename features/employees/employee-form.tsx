"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Briefcase, GraduationCap, Phone } from "lucide-react";
import { Input, Label, Select, Textarea, FieldGroup } from "@/components/ui/field";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PhotoInput } from "./photo-input";
import { CredentialsReveal } from "./credentials-reveal";

export const EMPLOYEE_FORM_ID = "employee-form";

type EmploymentStatus =
  | "ACTIVE" | "ON_LEAVE" | "RESIGNED" | "RETIRED"
  | "SUSPENDED" | "TERMINATED" | "INACTIVE";

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
  employmentType?: string | null;
  hireDate?: string | null;
  employmentStatus: EmploymentStatus;
  educationLevel?: string | null;
  fieldOfStudy?: string | null;
  institutionName?: string | null;
  graduationYear?: string | null;
  profileImageUrl?: string | null;
  userId?: string | null;
};

export type DepartmentOption = { id: string; name: string };
export type PositionOption = { id: string; name: string; departmentId: string };

export type LinkableUser = {
  id: string;
  name: string;
  username: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateInputValue(date?: string | null) {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="mb-5 flex items-center gap-2.5 border-b border-ink-900/8 pb-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="font-display text-base font-semibold text-ink-900">{title}</h3>
    </div>
  );
}

function RequiredMark() {
  return <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>;
}

// ── Standalone action buttons ─────────────────────────────────────────────────
// Uses HTML `form` attribute so they can sit outside the <form> on edit page.
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

// ── Main form ─────────────────────────────────────────────────────────────────
export function EmployeeForm({
  action,
  employee,
  linkableUsers = [],
  departments,
  positions,
}: {
  action: (prevState: unknown, formData: FormData) => Promise<unknown>;
  employee?: EmployeeFormValues;
  linkableUsers?: LinkableUser[];
  departments: DepartmentOption[];
  positions: PositionOption[];
}) {
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [state, formAction, isPending] = useActionState(action as any, null);

  const [selectedDepartmentId, setSelectedDepartmentId] = useState(employee?.departmentId ?? "");
  const positionsInDepartment = positions.filter((p) => p.departmentId === selectedDepartmentId);
  // Only pre-fill the position if it actually belongs to the currently selected department.
  const initialPositionId =
    employee?.positionId && positionsInDepartment.some((p) => p.id === employee.positionId)
      ? employee.positionId
      : "";

  // On create: redirect to the new employee's page — unless credentials were
  // generated, in which case we show them once first (see CredentialsReveal below).
  const createdData =
    state && (state as { success: boolean; data?: { id: string; credentials?: { username: string; password: string } } }).success && !employee
      ? (state as { data: { id: string; credentials?: { username: string; password: string } } }).data
      : null;

  useEffect(() => {
    if (createdData && !createdData.credentials) {
      router.push(`/employees/${createdData.id}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createdData]);

  // On update: show success toast
  const [showToast, setShowToast] = useState(false);
  useEffect(() => {
    if (state && (state as { success: boolean }).success && !!employee) {
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

  if (createdData?.credentials) {
    return (
      <CredentialsReveal
        employeeId={createdData.id}
        username={createdData.credentials.username}
        password={createdData.credentials.password}
      />
    );
  }

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

      {/* NOTE: form id is used by EmployeeFormActions via the HTML `form` attribute */}
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

            {/* Employee ID info */}
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
            <FieldGroup>
              <Label htmlFor="departmentId">Department<RequiredMark /></Label>
              <Select
                id="departmentId"
                name="departmentId"
                required
                value={selectedDepartmentId}
                onChange={(e) => setSelectedDepartmentId(e.target.value)}
              >
                <option value="" disabled>
                  Select department…
                </option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </Select>
            </FieldGroup>

            <FieldGroup>
              <Label htmlFor="positionId">Position / Job Title<RequiredMark /></Label>
              <Select
                id="positionId"
                name="positionId"
                required
                key={selectedDepartmentId}
                defaultValue={initialPositionId}
                disabled={!selectedDepartmentId}
              >
                <option value="" disabled>
                  {selectedDepartmentId ? "Select position…" : "Select a department first"}
                </option>
                {positionsInDepartment.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.name}
                  </option>
                ))}
              </Select>
            </FieldGroup>

            <FieldGroup>
              <Label htmlFor="employmentType">Employment Type</Label>
              <Select id="employmentType" name="employmentType" defaultValue={employee?.employmentType ?? ""}>
                <option value="">Not specified</option>
                <option value="PERMANENT">Permanent</option>
                <option value="CONTRACT">Contract</option>
                <option value="TEMPORARY">Temporary</option>
                <option value="PROBATION">Probation</option>
                <option value="INTERNSHIP">Internship</option>
              </Select>
            </FieldGroup>

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

        {/* ── Section 5: System Access ─────────────────────────────────── */}
        <Card className="p-6">
          <SectionHeader icon={User} title="System Access" />
          {isEdit ? (
            <>
              <p className="mb-4 text-sm text-ink-900/60">
                Link this employee record to a user account so they can sign in and use the employee
                portal. Only accounts without an existing employee record (or the one already linked
                here) are shown.
              </p>
              <FieldGroup>
                <Label htmlFor="userId">Linked User Account</Label>
                <Select id="userId" name="userId" defaultValue={employee?.userId ?? ""}>
                  <option value="">No linked account</option>
                  {linkableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                      {u.username ? ` (@${u.username})` : ""}
                    </option>
                  ))}
                </Select>
              </FieldGroup>
            </>
          ) : (
            <label className="flex items-start gap-2.5 text-sm text-ink-900">
              <input
                type="checkbox"
                name="createLogin"
                defaultChecked
                className="mt-0.5 h-4 w-4 rounded border-ink-900/25"
              />
              <span>
                Create a login account for this employee
                <span className="mt-0.5 block text-xs font-normal text-ink-900/50">
                  A username and temporary password will be generated automatically, shown once after
                  saving. The employee will be required to set a new password on first login. Uncheck
                  this if the employee doesn&apos;t need portal access (e.g. seasonal staff).
                </span>
              </span>
            </label>
          )}
        </Card>

      </form>

      {/* On /new: buttons render here (Documents card doesn't exist yet).
          On /[id]: the page renders <EmployeeFormActions> after the Documents card. */}
      {!isEdit && <EmployeeFormActions isEdit={false} isPending={isPending} />}
    </div>
  );
}
