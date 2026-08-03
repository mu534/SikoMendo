"use client";

import { useActionState, useEffect, useState } from "react";
import { Input, Label, Select, Textarea, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { recordEmploymentChange } from "./actions";

type DepartmentOption = { id: string; name: string };
type PositionOption = { id: string; name: string; departmentId: string };

export function EmploymentChangeForm({
  employeeId,
  departments,
  positions,
  currentDepartmentId,
  onDone,
}: {
  employeeId: string;
  departments: DepartmentOption[];
  positions: PositionOption[];
  currentDepartmentId?: string;
  onDone?: () => void;
}) {
  const action = recordEmploymentChange.bind(null, employeeId);
  const [state, formAction, isPending] = useActionState(action, null);

  const [selectedDepartmentId, setSelectedDepartmentId] = useState(currentDepartmentId ?? "");
  const positionsInDepartment = positions.filter((p) => p.departmentId === selectedDepartmentId);

  const errorMessage =
    state && (state as { success: boolean }).success === false
      ? (state as { error: { message: string } }).error.message
      : null;
  const succeeded = state !== null && (state as { success: boolean }).success === true;
  useEffect(() => {
    if (succeeded) onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [succeeded]);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-ink-900/8 bg-sand-50 p-5">
      <p className="text-sm font-medium text-ink-900">Record Employment Change</p>

      {errorMessage && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldGroup>
          <Label htmlFor="ec-departmentId">Department</Label>
          <Select
            id="ec-departmentId"
            name="departmentId"
            required
            value={selectedDepartmentId}
            onChange={(e) => setSelectedDepartmentId(e.target.value)}
          >
            <option value="" disabled>
              Select department…
            </option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="ec-positionId">Position</Label>
          <Select id="ec-positionId" name="positionId" required key={selectedDepartmentId} defaultValue="" disabled={!selectedDepartmentId}>
            <option value="" disabled>
              {selectedDepartmentId ? "Select position…" : "Select a department first"}
            </option>
            {positionsInDepartment.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </FieldGroup>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldGroup>
          <Label htmlFor="ec-employmentType">Employment Type</Label>
          <Select id="ec-employmentType" name="employmentType" defaultValue="">
            <option value="">Not specified</option>
            <option value="PERMANENT">Permanent</option>
            <option value="CONTRACT">Contract</option>
            <option value="TEMPORARY">Temporary</option>
            <option value="PROBATION">Probation</option>
            <option value="INTERNSHIP">Internship</option>
          </Select>
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="ec-effectiveDate">Effective Date</Label>
          <Input id="ec-effectiveDate" name="effectiveDate" type="date" required />
        </FieldGroup>
      </div>

      <FieldGroup>
        <Label htmlFor="ec-changeReason">Reason for Change</Label>
        <Input id="ec-changeReason" name="changeReason" required placeholder="e.g. Promotion, transfer, reorganization" />
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="ec-remarks">Remarks</Label>
        <Textarea id="ec-remarks" name="remarks" rows={2} placeholder="Optional" />
      </FieldGroup>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving…" : "Save Change"}
        </Button>
        {onDone && (
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
