"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { ContractForm } from "./contract-form";
import { terminateContract } from "./actions";

type ContractRow = {
  id: string;
  contractType: string;
  startDate: Date;
  endDate: Date | null;
  status: string;
  remarks: string | null;
  isExpiringSoon: boolean;
};

const STATUS_TONE: Record<string, "success" | "neutral" | "danger" | "warning"> = {
  ACTIVE: "success",
  EXPIRED: "neutral",
  TERMINATED: "danger",
  RENEWED: "neutral",
};

export function ContractsPanel({
  employeeId,
  contracts,
  canManage,
}: {
  employeeId: string;
  contracts: ContractRow[];
  canManage: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const t = useTranslations("contracts");
  const tC = useTranslations("common");
  const tE = useTranslations("employees");

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-ink-900">{contracts.length} {t("title")}</p>
          {!showForm && (
            <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5" />
              {t("addContract")}
            </Button>
          )}
        </div>
      )}

      {canManage && showForm && <ContractForm employeeId={employeeId} onDone={() => setShowForm(false)} />}

      <Table>
        <THead>
          <TH>{t("columns.type")}</TH>
          <TH>{t("columns.startDate")}</TH>
          <TH>{t("columns.endDate")}</TH>
          <TH>{t("columns.status")}</TH>
          {canManage && <TH className="text-right">{tC("actions")}</TH>}
        </THead>
        <TBody>
          {contracts.length === 0 && <EmptyRow colSpan={canManage ? 5 : 4}>{t("noContracts")}</EmptyRow>}
          {contracts.map((c) => (
            <TR key={c.id}>
              <TD>{tE(`types.${c.contractType as "PERMANENT"|"CONTRACT"|"TEMPORARY"|"PROBATION"|"INTERNSHIP"}`)}</TD>
              <TD>{formatDate(c.startDate)}</TD>
              <TD>{c.endDate ? formatDate(c.endDate) : tC("na")}</TD>
              <TD>
                <div className="flex items-center gap-2">
                  <Badge tone={STATUS_TONE[c.status] ?? "neutral"}>{t(`statuses.${c.status as "ACTIVE"|"EXPIRED"|"TERMINATED"|"RENEWED"}`)}</Badge>
                  {c.isExpiringSoon && <Badge tone="warning">{tC("loading")}</Badge>}
                </div>
              </TD>
              {canManage && (
                <TD className="text-right">
                  {c.status === "ACTIVE" && (
                    <form action={terminateContract.bind(null, c.id, employeeId) as unknown as (formData: FormData) => Promise<void>}>
                      <ConfirmSubmitButton
                        confirmMessage={t("confirmTerminate")}
                        confirmLabel={t("statuses.TERMINATED")}
                        variant="ghost"
                        size="sm"
                        className="text-red-600"
                      >
                        {t("statuses.TERMINATED")}
                      </ConfirmSubmitButton>
                    </form>
                  )}
                </TD>
              )}
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
