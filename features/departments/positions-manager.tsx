"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { setPositionActive } from "./actions";
import { PositionForm, type PositionFormValues } from "./position-form";

type PositionRow = PositionFormValues & { _count: { employees: number } };

export function PositionsManager({
  departmentId,
  positions,
  canManage,
}: {
  departmentId: string;
  positions: PositionRow[];
  canManage: boolean;
}) {
  const [addingNew, setAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink-900">{positions.length} position(s)</p>
        {canManage && !addingNew && (
          <Button size="sm" variant="outline" onClick={() => setAddingNew(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add position
          </Button>
        )}
      </div>

      {canManage && addingNew && (
        <PositionForm departmentId={departmentId} onDone={() => setAddingNew(false)} />
      )}

      <Table>
        <THead>
          <TH>Position</TH>
          <TH>Employees</TH>
          <TH>Status</TH>
          {canManage && <TH className="text-right">Actions</TH>}
        </THead>
        <TBody>
          {positions.length === 0 && !addingNew && (
            <EmptyRow colSpan={canManage ? 4 : 3}>No positions yet in this department.</EmptyRow>
          )}
          {positions.map((position) =>
            canManage && editingId === position.id ? (
              <tr key={position.id}>
                <td colSpan={4} className="p-3">
                  <PositionForm
                    departmentId={departmentId}
                    position={position}
                    onDone={() => setEditingId(null)}
                  />
                </td>
              </tr>
            ) : (
              <TR key={position.id}>
                <TD>
                  <p className="font-medium text-ink-900">{position.name}</p>
                  {position.description && <p className="text-xs text-ink-900/50">{position.description}</p>}
                </TD>
                <TD>{position._count.employees}</TD>
                <TD>
                  <Badge tone={position.isActive ? "success" : "neutral"}>
                    {position.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TD>
                {canManage && (
                  <TD className="text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setEditingId(position.id)}
                        className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <form action={() => setPositionActive(position.id, departmentId, !position.isActive)}>
                        <button type="submit" className="text-sm font-medium text-ink-900/50 hover:text-ink-900">
                          {position.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </form>
                    </div>
                  </TD>
                )}
              </TR>
            )
          )}
        </TBody>
      </Table>
    </div>
  );
}
