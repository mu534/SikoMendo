"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmploymentChangeForm } from "./employment-change-form";

type HistoryRow = {
  id: string;
  department: { name: string };
  position: { name: string };
  employmentType: string | null;
  effectiveDate: Date;
  endDate: Date | null;
  changeReason: string;
  remarks: string | null;
};

type DepartmentOption = { id: string; name: string };
type PositionOption   = { id: string; name: string; departmentId: string };
type LinkedUser       = { id: string; role: string } | null;

export function EmploymentHistoryPanel({
  employeeId,
  history,
  departments,
  positions,
  currentDepartmentId,
  canManage,
  linkedUser,
  canChangeRole,
}: {
  employeeId: string;
  history: HistoryRow[];
  departments: DepartmentOption[];
  positions: PositionOption[];
  currentDepartmentId: string;
  canManage: boolean;
  linkedUser?: LinkedUser;
  canChangeRole?: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const t = useTranslations("employmentHistory");
  const tC = useTranslations("common");

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-ink-900">{history.length} {tC("total")}</p>
          {!showForm && (
            <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5" />
              {t("recordChange")}
            </Button>
          )}
        </div>
      )}

      {canManage && showForm && (
        <EmploymentChangeForm
          employeeId={employeeId}
          departments={departments}
          positions={positions}
          currentDepartmentId={currentDepartmentId}
          linkedUser={linkedUser ?? null}
          canChangeRole={canChangeRole}
          onDone={() => setShowForm(false)}
        />
      )}

      <Table>
        <THead>
          <TH>{t("columns.department")}</TH>
          <TH>{t("columns.position")}</TH>
          <TH>{t("columns.type")}</TH>
          <TH>{t("columns.effectiveDate")}</TH>
          <TH>{t("columns.endDate")}</TH>
          <TH>{t("columns.reason")}</TH>
        </THead>
        <TBody>
          {history.length === 0 && (
            <EmptyRow colSpan={6}>{t("noHistory")}</EmptyRow>
          )}
          {history.map((h) => (
            <TR key={h.id}>
              <TD>{h.department.name}</TD>
              <TD>{h.position.name}</TD>
              <TD>{h.employmentType ?? tC("na")}</TD>
              <TD>{formatDate(h.effectiveDate)}</TD>
              <TD>
                {h.endDate ? formatDate(h.endDate) : <Badge tone="success">{tC("active")}</Badge>}
              </TD>
              <TD>
                <p>{h.changeReason}</p>
                {h.remarks && <p className="text-xs text-ink-900/45">{h.remarks}</p>}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
