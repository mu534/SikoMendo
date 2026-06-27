"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  User, MapPin, Briefcase, GraduationCap, Phone, Building2
} from "lucide-react";
import { Input, Label, Select, Textarea, FieldGroup } from "@/components/ui/field";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PhotoInput } from "./photo-input";

type EmploymentStatus = "ACTIVE" | "ON_LEAVE" | "RESIGNED" | "RETIRED" | "SUSPENDED" | "TERMINATED" | "INACTIVE";

export type EmployeeFormValues = {
  id?: string;
  employeeId?: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  gender?: "MALE" | "FEMALE" | null;
  dateOfBirth?: Date | null;
  maritalStatus?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  department?: string | null;
  position?: string | null;
  employmentType?: string | null;
  hireDate?: Date | null;
  employmentStatus: EmploymentStatus;
  educationLevel?: string | null;
  fieldOfStudy?: string | null;
  institutionName?: string | null;
  graduationYear?: string | null;
  cooperativeId?: string | null;
  userId?: string | null;
  profileImageUrl?: string | null;
};

function toDateInputValue(date?: Date | null) {
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

export function EmployeeForm({
  action,
  employee,
  cooperatives,
  linkableUsers,
}: {
  action: (prevState: unknown, formData: FormData) => Promise<unknown>;
  employee?: EmployeeFormValues;
  cooperatives: { id: string; name: string }[];
  linkableUsers: { id: string; name: string; email: string }[];
}) {
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [state, formAction, isPending] = useActionState(action as any, null);

  useEffect(() => {
    if (state && (state as { success: boolean; data?: { id: string } }).success) {
      const id = (state as { data: { id: string } }).data.id;
      router.push(`/employees/${id}`);
    }
  }, [state, router]);

  const errorMessage =
    state && !(state as { success: boolean }).success
      ? (state as { error: { message: string } }).error.message
      : null;

  return (
    <div className="max-w-3xl space-y-5">
      {errorMessage && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {errorMessage}
        </div>
      )}

      <form action={formAction} className="space-y-5">

        {/* ── Section 1: Personal Information ──────────────────────────── */}
        <Card className="p-6">
          <SectionHeader icon={User} title="Personal Information" />
          <div className="space-y-5">
            <PhotoInput
              name="photo"
              currentName={`${employee?.firstName ?? ""} ${employee?.lastName ?? ""}`}
              currentUrl={employee?.profileImageUrl}
            />

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FieldGroup>
                <Label htmlFor="firstName">First Name<RequiredMark /></Label>
                <Input id="firstName" name="firstName" required defaultValue={employee?.firstName} />
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="lastName">Last Name<RequiredMark /></Label>
                <Input id="lastName" name="lastName" required defaultValue={employee?.lastName} />
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
              <Label htmlFor="emergencyContactPhone">Contact Phone</Label>
              <Input id="emergencyContactPhone" name="emergencyContactPhone" placeholder="+251 9XX XXX XXX" defaultValue={employee?.emergencyContactPhone ?? ""} />
            </FieldGroup>
          </div>
        </Card>

        {/* ── Section 3: Employment Information ────────────────────────── */}
        <Card className="p-6">
          <SectionHeader icon={Briefcase} title="Employment Information" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FieldGroup>
              <Label htmlFor="department">Department</Label>
              <Input id="department" name="department" defaultValue={employee?.department ?? ""} />
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="position">Position</Label>
              <Input id="position" name="position" defaultValue={employee?.position ?? ""} />
            </FieldGroup>

            <FieldGroup>
              <Label htmlFor="employmentType">Employment Type</Label>
              <Select id="employmentType" name="employmentType" defaultValue={employee?.employmentType ?? ""}>
                <option value="">Not specified</option>
                <option value="Full-Time">Full-Time</option>
                <option value="Part-Time">Part-Time</option>
                <option value="Contract">Contract</option>
                <option value="Casual">Casual</option>
              </Select>
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="hireDate">Date of Employment</Label>
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
            <FieldGroup>
              <Label htmlFor="cooperativeId">Cooperative</Label>
              <Select id="cooperativeId" name="cooperativeId" defaultValue={employee?.cooperativeId ?? ""}>
                <option value="">Unassigned</option>
                {cooperatives.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </FieldGroup>

            <FieldGroup>
              <Label htmlFor="userId">Linked System Account</Label>
              <Select id="userId" name="userId" defaultValue={employee?.userId ?? ""}>
                <option value="">No login linked</option>
                {linkableUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} — {u.email}</option>
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

        {/* ── Action Buttons ────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3 border-t border-ink-900/8 pt-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Saving…
              </span>
            ) : employee ? "Save changes" : "Create employee"}
          </Button>
          <Button type="reset" variant="outline">Reset</Button>
          <ButtonLink href="/employees" variant="ghost">Cancel</ButtonLink>
        </div>
      </form>
    </div>
  );
}
