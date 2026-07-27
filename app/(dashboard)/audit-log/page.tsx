import { ShieldCheck } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { listAuditLog, listAuditLogFilterOptions } from "@/features/audit-log/queries";
import { parsePageParam, parseStringParam, formatDateTime } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Select } from "@/components/ui/field";
import { Toolbar } from "@/components/ui/toolbar";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";

const ACTION_TONE: Record<string, BadgeTone> = {
  CREATE: "success",
  RESTORE: "success",
  UNBAN: "success",
  APPROVE: "success",
  UPDATE: "brand",
  UPSERT: "brand",
  UPDATE_PROFILE: "brand",
  BULK_MARK_PRESENT: "brand",
  CANCEL: "neutral",
  DELETE: "danger",
  ARCHIVE: "danger",
  BAN: "danger",
  REJECT: "danger",
};

function actionTone(action: string): BadgeTone {
  return ACTION_TONE[action] ?? "neutral";
}

function actionLabel(action: string) {
  return action.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("VIEW_AUDIT_LOG");
  const params = await searchParams;

  const q = parseStringParam(params.q);
  const entity = parseStringParam(params.entity);
  const action = parseStringParam(params.action);
  const page = parsePageParam(params.page);

  const [{ items, total, totalPages }, filterOptions] = await Promise.all([
    listAuditLog({ q, entity, action, page }),
    listAuditLogFilterOptions(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">Audit Log</h2>
        <p className="mt-1 text-sm text-ink-900/60">
          A complete, append-only record of who changed what, and when, across the system.
        </p>
      </div>

      <Card>
        <Toolbar basePath="/audit-log" searchPlaceholder="Search by user or record ID" searchDefault={q}>
          <Select name="entity" defaultValue={entity} className="w-44">
            <option value="">All record types</option>
            {filterOptions.entities.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </Select>
          <Select name="action" defaultValue={action} className="w-44">
            <option value="">All actions</option>
            {filterOptions.actions.map((a) => (
              <option key={a} value={a}>
                {actionLabel(a)}
              </option>
            ))}
          </Select>
        </Toolbar>

        <Table>
          <THead>
            <TH>When</TH>
            <TH>User</TH>
            <TH>Action</TH>
            <TH>Record</TH>
            <TH>Changes</TH>
          </THead>
          <TBody>
            {items.length === 0 && (
              <EmptyRow colSpan={5}>
                <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-ink-900/20" />
                No activity matches your filters.
              </EmptyRow>
            )}
            {items.map((entry) => (
              <TR key={entry.id}>
                <TD className="whitespace-nowrap">{formatDateTime(entry.createdAt)}</TD>
                <TD>{entry.user?.name ?? <span className="text-ink-900/40">System</span>}</TD>
                <TD>
                  <Badge tone={actionTone(entry.action)}>{actionLabel(entry.action)}</Badge>
                </TD>
                <TD>
                  <p className="font-medium text-ink-900">{entry.entity}</p>
                  {entry.entityId && <p className="text-xs text-ink-900/45">{entry.entityId}</p>}
                </TD>
                <TD>
                  {entry.changes ? (
                    <details className="group">
                      <summary className="cursor-pointer select-none text-sm font-medium text-brand-700 hover:underline">
                        View
                      </summary>
                      <pre className="mt-2 max-w-sm overflow-x-auto rounded-lg bg-sand-100 p-2.5 text-xs text-ink-900/70">
                        {JSON.stringify(entry.changes, null, 2)}
                      </pre>
                    </details>
                  ) : (
                    <span className="text-xs text-ink-900/40">—</span>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>

        <Pagination
          basePath="/audit-log"
          params={{ q, entity, action }}
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={10}
        />
      </Card>
    </div>
  );
}