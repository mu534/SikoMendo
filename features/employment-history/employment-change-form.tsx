"use client";

import { useActionState, useEffect, useState } from "react";
import { Input, Label, Select, Textarea, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ROLES, roleLabel } from "@/lib/permissions";
import { recordEmploymentChange } from "./actions";

type DepartmentOption = { id: string; name: string };
type PositionOption   = { id: string; name: string; departmentId: string };

/** Minimal linked-user info the form needs to show the role selector. */
type LinkedUser = { id: string; role: string } | null;

export function EmploymentChangeForm({
  employeeId,
  departments,
  positions,
  currentDepartmentId,
  linkedUser,
  canChangeRole,
  onDone,
}: {
  employeeId: string;
  departments: DepartmentOption[];
  positions: PositionOption[];
  currentDepartmentId?: string;
  /** The employee's linked system account, if any. */
  linkedUser?: LinkedUser;
  /**
   * True only when the caller has MANAGE_ROLES (ADMIN).
   * The server enforces this independently — this flag only controls
   * whether the role selector is rendered in the UI.
   */
  canChangeRole?: boolean;
  onDone?: () => void;
}) {
  const action = recordEmploymentChange.bind(null, employeeId);
  const [state, formAction, isPending] = useActionState(action, null);

  const [selectedDepartmentId, setSelectedDepartmentId] = useState(
    currentDepartmentId ?? ""
  );
  const positionsInDepartment = positions.filter(
    (p) => p.departmentId === selectedDepartmentId
  );

  const errorMessage =
    state && (state as { success: boolean }).success === false
      ? (state as { error: { message: string } }).error.message
      : null;
  const succeeded =
    state !== null && (state as { success: boolean }).success === true;

  useEffect(() => {
    if (succeeded) onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [succeeded]);

  const showRoleSelector = canChangeRole && linkedUser;

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-xl border border-ink-900/8 bg-sand-50 p-5"
    >
      <p className="text-sm font-medium text-ink-900">Record Employment Change</p>

      {errorMessage && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700"
        >
          {errorMessage}
        </div>
      )}

      {/* ── Department / Position ─────────────────────────────── */}
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
          <Select
            id="ec-positionId"
            name="positionId"
            required
            key={selectedDepartmentId}
            defaultValue=""
            disabled={!selectedDepartmentId}
          >
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

      {/* ── Employment type / Effective date ─────────────────── */}
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

      {/* ── Reason / Remarks ─────────────────────────────────── */}
      <FieldGroup>
        <Label htmlFor="ec-changeReason">Reason for Change</Label>
        <Input
          id="ec-changeReason"
          name="changeReason"
          required
          placeholder="e.g. Promotion, transfer, reorganization"
        />
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="ec-remarks">Remarks</Label>
        <Textarea id="ec-remarks" name="remarks" rows={2} placeholder="Optional" />
      </FieldGroup>

      {/* ── System role change (ADMIN only, employee must have account) ── */}
      {showRoleSelector && (
        <div className="space-y-2 rounded-xl border border-gold-400/30 bg-gold-400/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/55">
            System Role Change
          </p>
          <p className="text-xs text-ink-900/60">
            The employee&apos;s linked account currently has the{" "}
            <span className="font-medium text-ink-900">
              {roleLabel(linkedUser.role)}
            </span>{" "}
            system role. Select a new role only if this employment change requires a
            change in HRMIS access level. Note: system role is independent of job title —
            a &ldquo;Finance Manager&rdquo; position does not automatically require the
            General Manager system role.
          </p>
          <FieldGroup>
            <Label htmlFor="ec-newRole">New system role</Label>
            <Select id="ec-newRole" name="newRole" defaultValue="">
              <option value="">— No change —</option>
              {ROLES.filter((r) => r !== linkedUser.role).map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </Select>
          </FieldGroup>
        </div>
      )}

      {/* ── If employee has no account, note it ──────────────── */}
      {canChangeRole && !linkedUser && (
        <p className="text-xs text-ink-900/45">
          This employee has no linked system account — no role change is possible
          until an account is created from the employee profile.
        </p>
      )}

      {/* ── Actions ──────────────────────────────────────────── */}
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
