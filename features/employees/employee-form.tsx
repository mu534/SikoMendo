"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Briefcase, GraduationCap, Phone } from "lucide-react";
import { Input, Label, Select, Textarea, FieldGroup } from "@/components/ui/field";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PhotoInput } from "./photo-input";

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
  department?: string | null;
  position?: string | null;
  employmentType?: string | null;
  hireDate?: string | null;
  employmentStatus: EmploymentStatus;
  educationLevel?: string | null;
  fieldOfStudy?: string | null;
  institutionName?: string | null;
  graduationYear?: string | null;
  profileImageUrl?: string | null;
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
}: {
  action: (prevState: unknown, formData: FormData) => Promise<unknown>;
  employee?: EmployeeFormValues;
}) {
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [state, formAction, isPending] = useActionState(action as any, null);

  // On create: redirect to new employee's page
  useEffect(() => {
    if (state && (state as { success: boolean; data?: { id: string } }).success && !employee) {
      router.push(`/employees/${(state as { data: { id: string } }).data.id}`);
    }
  }, [state, router, employee]);

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
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Divorced">Divorced</option>
                  <option value="Widowed">Widowed</option>
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
              <Label htmlFor="department">Department</Label>
              <Select id="department" name="department" defaultValue={employee?.department ?? ""}>
                <option value="">Select department…</option>
                <option value="Administration">Administration</option>
                <option value="Finance & Accounting">Finance &amp; Accounting</option>
                <option value="Human Resources">Human Resources</option>
                <option value="Information Technology">Information Technology</option>
                <option value="Cooperative Operations">Cooperative Operations</option>
                <option value="Field Extension">Field Extension</option>
                <option value="Marketing & Sales">Marketing &amp; Sales</option>
                <option value="Procurement & Logistics">Procurement &amp; Logistics</option>
                <option value="Audit & Compliance">Audit &amp; Compliance</option>
                <option value="Planning & Development">Planning &amp; Development</option>
                <option value="Legal">Legal</option>
                <option value="Training & Capacity Building">Training &amp; Capacity Building</option>
                <option value="Other">Other</option>
              </Select>
            </FieldGroup>

            <FieldGroup>
              <Label htmlFor="position">Position / Job Title</Label>
              <Input id="position" name="position" defaultValue={employee?.position ?? ""} />
            </FieldGroup>

            <FieldGroup>
              <Label htmlFor="employmentType">Employment Type</Label>
              <Select id="employmentType" name="employmentType" defaultValue={employee?.employmentType ?? ""}>
                <option value="">Not specified</option>
                <option value="Permanent">Permanent</option>
                <option value="Contract">Contract</option>
                <option value="Temporary">Temporary</option>
                <option value="Part-Time">Part-Time</option>
                <option value="Casual">Casual</option>
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
                <option value="Primary">Primary</option>
                <option value="Secondary">Secondary</option>
                <option value="Diploma">Diploma</option>
                <option value="Bachelor">Bachelor&apos;s Degree</option>
                <option value="Master">Master&apos;s Degree</option>
                <option value="PhD">PhD</option>
                <option value="Other">Other</option>
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

      {/* On /new: buttons render here (Documents card doesn't exist yet).
          On /[id]: the page renders <EmployeeFormActions> after the Documents card. */}
      {!isEdit && <EmployeeFormActions isEdit={false} isPending={isPending} />}
    </div>
  );
}
