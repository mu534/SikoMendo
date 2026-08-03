"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
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
type PositionOption = { id: string; name: string; departmentId: string };

export function EmploymentHistoryPanel({
  employeeId,
  history,
  departments,
  positions,
  currentDepartmentId,
  canManage,
  formatDate,
}: {
  employeeId: string;
  history: HistoryRow[];
  departments: DepartmentOption[];
  positions: PositionOption[];
  currentDepartmentId: string;
  canManage: boolean;
  formatDate: (d: Date | string | null) => string;
}) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-ink-900">{history.length} record(s)</p>
          {!showForm && (
            <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5" />
              Record Employment Change
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
          onDone={() => setShowForm(false)}
        />
      )}

      <Table>
        <THead>
          <TH>Department</TH>
          <TH>Position</TH>
          <TH>Type</TH>
          <TH>Effective</TH>
          <TH>End</TH>
          <TH>Reason</TH>
        </THead>
        <TBody>
          {history.length === 0 && <EmptyRow colSpan={6}>No employment history yet.</EmptyRow>}
          {history.map((h) => (
            <TR key={h.id}>
              <TD>{h.department.name}</TD>
              <TD>{h.position.name}</TD>
              <TD>{h.employmentType ?? "—"}</TD>
              <TD>{formatDate(h.effectiveDate)}</TD>
              <TD>
                {h.endDate ? (
                  formatDate(h.endDate)
                ) : (
                  <Badge tone="success">Current</Badge>
                )}
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
