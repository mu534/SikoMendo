"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Input, Label, Select, Textarea, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ROLES, roleLabel } from "@/lib/permissions";
import { recordEmploymentChange } from "./actions";

type DepartmentOption = { id: string; name: string };
type PositionOption   = { id: string; name: string; departmentId: string };
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
  linkedUser?: LinkedUser;
  canChangeRole?: boolean;
  onDone?: () => void;
}) {
  const action = recordEmploymentChange.bind(null, employeeId);
  const [state, formAction, isPending] = useActionState(action, null);
  const t = useTranslations("employmentHistory");
  const tE = useTranslations("employees");
  const tC = useTranslations("common");

  const [selectedDepartmentId, setSelectedDepartmentId] = useState(currentDepartmentId ?? "");
  const positionsInDepartment = positions.filter((p) => p.departmentId === selectedDepartmentId);

  const errorMessage =
    state && (state as { success: boolean }).success === false
      ? (state as { error: { message: string } }).error.message : null;
  const succeeded = state !== null && (state as { success: boolean }).success === true;

  useEffect(() => {
    if (succeeded) onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [succeeded]);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-ink-900/8 bg-sand-50 p-5">
      <p className="text-sm font-medium text-ink-900">{t("recordChange")}</p>

      {errorMessage && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldGroup>
          <Label htmlFor="ec-departmentId">{t("form.department")}</Label>
          <Select id="ec-departmentId" name="departmentId" required value={selectedDepartmentId} onChange={(e) => setSelectedDepartmentId(e.target.value)}>
            <option value="" disabled>{tE("form.selectDepartment")}</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="ec-positionId">{t("form.position")}</Label>
          <Select id="ec-positionId" name="positionId" required key={selectedDepartmentId} defaultValue="" disabled={!selectedDepartmentId}>
            <option value="" disabled>{selectedDepartmentId ? tE("form.selectPosition") : tE("form.selectDepartment")}</option>
            {positionsInDepartment.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </FieldGroup>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldGroup>
          <Label htmlFor="ec-employmentType">{t("form.employmentType")}</Label>
          <Select id="ec-employmentType" name="employmentType" defaultValue="">
            <option value="">{tC("optional")}</option>
            {(["PERMANENT","CONTRACT","TEMPORARY","PROBATION","INTERNSHIP"] as const).map((v) => (
              <option key={v} value={v}>{tE(`types.${v}`)}</option>
            ))}
          </Select>
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="ec-effectiveDate">{t("form.effectiveDate")}</Label>
          <Input id="ec-effectiveDate" name="effectiveDate" type="date" required />
        </FieldGroup>
      </div>

      <FieldGroup>
        <Label htmlFor="ec-changeReason">{t("form.changeReason")}</Label>
        <Input id="ec-changeReason" name="changeReason" required placeholder={t("form.reasonPlaceholder")} />
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="ec-remarks">{t("form.remarks")}</Label>
        <Textarea id="ec-remarks" name="remarks" rows={2} placeholder={tC("optional")} />
      </FieldGroup>

      {canChangeRole && linkedUser && (
        <div className="space-y-2 rounded-xl border border-gold-400/30 bg-gold-400/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/55">{tC("update")}</p>
          <FieldGroup>
            <Label htmlFor="ec-newRole">{tC("update")}</Label>
            <Select id="ec-newRole" name="newRole" defaultValue="">
              <option value="">{tC("none")}</option>
              {ROLES.filter((r) => r !== linkedUser.role).map((r) => (
                <option key={r} value={r}>{roleLabel(r)}</option>
              ))}
            </Select>
          </FieldGroup>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? t("form.saving") : t("form.save")}
        </Button>
        {onDone && (
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>{tC("cancel")}</Button>
        )}
      </div>
    </form>
  );
}
