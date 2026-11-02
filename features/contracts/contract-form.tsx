"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Input, Label, Select, Textarea, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { createContract } from "./actions";
import { CONTRACT_TYPES } from "./schemas";

const TYPE_LABELS: Record<string, string> = {
  PERMANENT: "Permanent",
  CONTRACT: "Contract",
  TEMPORARY: "Temporary",
  PROBATION: "Probation",
  INTERNSHIP: "Internship",
};

export function ContractForm({ employeeId, onDone }: { employeeId: string; onDone?: () => void }) {
  const action = createContract.bind(null, employeeId);
  const [state, formAction, isPending] = useActionState(action, null);
  const t = useTranslations("contracts");
  const tE = useTranslations("employees");
  const tC = useTranslations("common");

  const succeeded = state !== null && (state as { success: boolean }).success === true;
  useEffect(() => {
    if (succeeded) onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [succeeded]);

  const errorMessage =
    state && (state as { success: boolean }).success === false
      ? (state as { error: { message: string } }).error.message
      : null;

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-ink-900/8 bg-sand-50 p-5">
      <p className="text-sm font-medium text-ink-900">{t("addContract")}</p>

      {errorMessage && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">{errorMessage}</div>
      )}

      <FieldGroup>
        <Label htmlFor="contractType">{t("form.contractType")}</Label>
        <Select id="contractType" name="contractType" required defaultValue="">
          <option value="" disabled>{tC("type")}</option>
          {CONTRACT_TYPES.map((ct) => (
            <option key={ct} value={ct}>{tE(`types.${ct as "PERMANENT"|"CONTRACT"|"TEMPORARY"|"PROBATION"|"INTERNSHIP"}`)}</option>
          ))}
        </Select>
      </FieldGroup>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldGroup>
          <Label htmlFor="startDate">{t("form.startDate")}</Label>
          <Input id="startDate" name="startDate" type="date" required />
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="endDate">{t("form.endDate")}</Label>
          <Input id="endDate" name="endDate" type="date" />
        </FieldGroup>
      </div>

      <FieldGroup>
        <Label htmlFor="remarks">{tC("remarks")}</Label>
        <Textarea id="remarks" name="remarks" rows={2} placeholder={tC("optional")} />
      </FieldGroup>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? tC("saving") : t("form.save")}
        </Button>
        {onDone && (
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>{tC("cancel")}</Button>
        )}
      </div>
    </form>
  );
}
