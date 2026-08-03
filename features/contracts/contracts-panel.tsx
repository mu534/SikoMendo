"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
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
  formatDate,
}: {
  employeeId: string;
  contracts: ContractRow[];
  canManage: boolean;
  formatDate: (d: Date | string | null) => string;
}) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-ink-900">{contracts.length} contract(s)</p>
          {!showForm && (
            <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5" />
              New Contract
            </Button>
          )}
        </div>
      )}

      {canManage && showForm && <ContractForm employeeId={employeeId} onDone={() => setShowForm(false)} />}

      <Table>
        <THead>
          <TH>Type</TH>
          <TH>Start</TH>
          <TH>End</TH>
          <TH>Status</TH>
          {canManage && <TH className="text-right">Actions</TH>}
        </THead>
        <TBody>
          {contracts.length === 0 && <EmptyRow colSpan={canManage ? 5 : 4}>No contracts on record.</EmptyRow>}
          {contracts.map((c) => (
            <TR key={c.id}>
              <TD>{c.contractType}</TD>
              <TD>{formatDate(c.startDate)}</TD>
              <TD>{c.endDate ? formatDate(c.endDate) : "—"}</TD>
              <TD>
                <div className="flex items-center gap-2">
                  <Badge tone={STATUS_TONE[c.status] ?? "neutral"}>{c.status}</Badge>
                  {c.isExpiringSoon && <Badge tone="warning">Expiring soon</Badge>}
                </div>
              </TD>
              {canManage && (
                <TD className="text-right">
                  {c.status === "ACTIVE" && (
                    <form
                      action={async () => {
                        "use server";
                        await terminateContract(c.id, employeeId);
                      }}
                    >
                      <ConfirmSubmitButton
                        confirmMessage="Terminate this contract? This can't be undone."
                        confirmLabel="Terminate"
                        variant="ghost"
                        size="sm"
                        className="text-red-600"
                      >
                        Terminate
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
