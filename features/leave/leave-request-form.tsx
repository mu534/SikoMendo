"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Input, Label, Select, Textarea, FieldGroup, FieldError } from "@/components/ui/field";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { submitLeaveRequest } from "./actions";
import { LEAVE_TYPES } from "./schemas";
import type { LeaveBalanceEntry } from "./queries";
import { validateLeaveDocumentFile, LEAVE_DOCUMENT_MAX_BYTES, formatBytes } from "@/lib/file-limits";

type ActionState = { success: true; data: { id: string } } | { success: false; error: { message: string } } | null;

function calculateTotalDays(start: string, end: string): number | null {
  if (!start || !end) return null;
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  const diff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? diff : null;
}

export function LeaveRequestForm({ balances = [] }: { balances?: LeaveBalanceEntry[] }) {
  const router = useRouter();
  const t = useTranslations("leave");
  const tC = useTranslations("common");
  const tV = useTranslations("validation");
  const [state, formAction, isPending] = useActionState(submitLeaveRequest, null);
  const typedState = state as ActionState;

  const [leaveType, setLeaveType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [docError, setDocError] = useState<string | null>(null);

  const totalDays = useMemo(() => calculateTotalDays(startDate, endDate), [startDate, endDate]);
  const selectedBalance = useMemo(
    () => balances.find((b) => b.leaveType === leaveType) ?? null,
    [balances, leaveType]
  );

  useEffect(() => {
    if (typedState?.success) {
      router.push("/leave");
      router.refresh();
    }
  }, [typedState, router]);

  const errorMessage = typedState && typedState.success === false ? typedState.error.message : null;

  return (
    <Card className="max-w-2xl p-6">
      <form action={formAction} className="space-y-5">
        {errorMessage && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
            {errorMessage}
          </div>
        )}

        <FieldGroup>
          <Label htmlFor="leaveType">{t("form.leaveType")}</Label>
          <Select
            id="leaveType"
            name="leaveType"
            required
            value={leaveType}
            onChange={(e) => setLeaveType(e.target.value)}
          >
            <option value="" disabled>{t("form.selectLeaveType")}</option>
            {LEAVE_TYPES.map((type) => (
              <option key={type} value={type}>{t(`types.${type}`)}</option>
            ))}
          </Select>
          {selectedBalance && (
            <p className="mt-1.5 text-xs text-ink-900/50">
              {selectedBalance.remaining === null
                ? t("noBalance")
                : `${selectedBalance.remaining} / ${selectedBalance.entitled}`}
            </p>
          )}
        </FieldGroup>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="startDate">{t("form.startDate")}</Label>
            <Input
              id="startDate"
              name="startDate"
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="endDate">{t("form.endDate")}</Label>
            <Input
              id="endDate"
              name="endDate"
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </FieldGroup>
        </div>

        <div className="rounded-lg bg-sand-100 px-4 py-3 text-sm text-ink-900/70">
          {t("form.calculatedDays", { days: totalDays ?? "—" })}
        </div>
        {startDate && endDate && totalDays === null && (
          <FieldError>{tV("dateRangeInvalid")}</FieldError>
        )}

        <FieldGroup>
          <Label htmlFor="reason">{t("form.reason")}</Label>
          <Textarea id="reason" name="reason" rows={4} required placeholder={t("form.reasonPlaceholder")} />
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="document">{tC("optional")}</Label>
          <input
            id="document"
            name="document"
            type="file"
            className="block text-sm"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) { setDocError(null); return; }
              const err = validateLeaveDocumentFile(file);
              setDocError(err);
              if (err) e.target.value = "";
            }}
          />
          <p className="mt-1 text-xs text-ink-900/45">
            PDF, JPG, PNG, WebP, DOC, DOCX · max {formatBytes(LEAVE_DOCUMENT_MAX_BYTES)}
          </p>
          {docError && <p role="alert" className="mt-1 text-xs font-medium text-red-600">{docError}</p>}
        </FieldGroup>

        <div className="flex items-center gap-3 border-t border-ink-900/8 pt-5">
          <Button type="submit" disabled={isPending || !!docError}>
            {isPending ? t("form.submitting") : t("form.submitRequest")}
          </Button>
          <ButtonLink href="/leave" variant="ghost">{tC("cancel")}</ButtonLink>
        </div>
      </form>
    </Card>
  );
}
