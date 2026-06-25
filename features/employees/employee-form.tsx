"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Input, Label, Select, Textarea, FieldGroup } from "@/components/ui/field";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PhotoInput } from "./photo-input";

type EmploymentStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "TERMINATED";

export type EmployeeFormValues = {
  id?: string;
  employeeId?: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  gender?: "MALE" | "FEMALE" | null;
  dateOfBirth?: Date | null;
  address?: string | null;
  department?: string | null;
  position?: string | null;
  hireDate?: Date | null;
  employmentStatus: EmploymentStatus;
  cooperativeId?: string | null;
  userId?: string | null;
  profileImageUrl?: string | null;
};

function toDateInputValue(date?: Date | null) {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- action result shape is ActionResult<{id:string}>, kept loose here for create/update sharing
  const [state, formAction, isPending] = useActionState(action as any, null);

  useEffect(() => {
    if (state && (state as { success: boolean; data?: { id: string } }).success) {
      const id = (state as { data: { id: string } }).data.id;
      router.push(`/employees/${id}`);
    }
  }, [state, router]);

  const errorMessage = state && !(state as { success: boolean }).success ? (state as { error: { message: string } }).error.message : null;

  return (
    <Card className="max-w-3xl p-6">
      <form action={formAction} className="space-y-6">
        <PhotoInput name="photo" currentName={`${employee?.firstName ?? ""} ${employee?.lastName ?? ""}`} currentUrl={employee?.profileImageUrl} />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" name="firstName" required defaultValue={employee?.firstName} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="lastName">Last name</Label>
            <Input id="lastName" name="lastName" required defaultValue={employee?.lastName} />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={employee?.email ?? ""} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" placeholder="+251 9XX XXX XXX" defaultValue={employee?.phone ?? ""} />
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
            <Label htmlFor="dateOfBirth">Date of birth</Label>
            <Input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={toDateInputValue(employee?.dateOfBirth)} />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="department">Department</Label>
            <Input id="department" name="department" defaultValue={employee?.department ?? ""} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="position">Position</Label>
            <Input id="position" name="position" defaultValue={employee?.position ?? ""} />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="hireDate">Hire date</Label>
            <Input id="hireDate" name="hireDate" type="date" defaultValue={toDateInputValue(employee?.hireDate)} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="employmentStatus">Employment status</Label>
            <Select id="employmentStatus" name="employmentStatus" required defaultValue={employee?.employmentStatus ?? "ACTIVE"}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="TERMINATED">Terminated</option>
            </Select>
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="cooperativeId">Cooperative</Label>
            <Select id="cooperativeId" name="cooperativeId" defaultValue={employee?.cooperativeId ?? ""}>
              <option value="">Unassigned</option>
              {cooperatives.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="userId">Linked system account</Label>
            <Select id="userId" name="userId" defaultValue={employee?.userId ?? ""}>
              <option value="">No login linked</option>
              {linkableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — {u.email}
                </option>
              ))}
            </Select>
          </FieldGroup>
        </div>

        <FieldGroup>
          <Label htmlFor="address">Address</Label>
          <Textarea id="address" name="address" rows={2} defaultValue={employee?.address ?? ""} />
        </FieldGroup>

        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

        <div className="flex items-center gap-3 border-t border-ink-900/8 pt-5">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : employee ? "Save changes" : "Create employee"}
          </Button>
          <ButtonLink href="/employees" variant="ghost">
            Cancel
          </ButtonLink>
        </div>
      </form>
    </Card>
  );
}
