import { Search, ShieldCheck } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { listAuditLog, listAuditLogFilterOptions } from "@/features/audit-log/queries";
import { parsePageParam, parseStringParam, formatDateTime } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, Input } from "@/components/ui/field";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { AuditChangesCell } from "@/features/audit-log/audit-changes-cell";

// ── Action tone map ───────────────────────────────────────────────────────────
// Maps every known action verb to a visual badge tone.

const ACTION_TONE: Record<string, BadgeTone> = {
  // Create / positive
  CREATE: "success",
  RESTORE: "success",
  REACTIVATE: "success",
  ACTIVATE: "success",
  APPROVE: "success",
  // Update / informational
  UPDATE: "brand",
  UPSERT: "brand",
  UPDATE_PROFILE: "brand",
  UPDATE_OWN_INFO: "brand",
  BULK_MARK_PRESENT: "brand",
  PASSWORD_CHANGED: "brand",
  FORCE_PASSWORD_CHANGE: "brand",
  PASSWORD_RESET: "brand",
  // Neutral
  CANCEL: "neutral",
  DEACTIVATE: "neutral",
  TERMINATE: "neutral",
  // Destructive / negative
  DELETE: "danger",
  ARCHIVE: "danger",
  SUSPEND: "danger",
  REJECT: "danger",
};

function actionTone(action: string): BadgeTone {
  return ACTION_TONE[action] ?? "neutral";
}

function actionLabel(action: string) {
  return action
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("VIEW_AUDIT_LOG");
  const params = await searchParams;

  const q        = parseStringParam(params.q);
  const entity   = parseStringParam(params.entity);
  const action   = parseStringParam(params.action);
  const userId   = parseStringParam(params.user);
  const dateFrom = parseStringParam(params.dateFrom);
  const dateTo   = parseStringParam(params.dateTo);
  const page     = parsePageParam(params.page);

  const hasFilters = !!(q || entity || action || userId || dateFrom || dateTo);

  const [{ items, total, totalPages }, filterOptions] = await Promise.all([
    listAuditLog({ q, entity, action, userId, dateFrom, dateTo, page }),
    listAuditLogFilterOptions(),
  ]);

  return (
    <div className="space-y-5">
      {/* ── Page header ─────────────────────────────────────────── */}
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">Audit Log</h2>
        <p className="mt-1 text-sm text-ink-900/60">
          Append-only record of who changed what, and when.
          {total > 0 && (
            <span className="ml-1">
              {hasFilters
                ? `${total} matching event${total === 1 ? "" : "s"}.`
                : `${total} event${total === 1 ? "" : "s"} total.`}
            </span>
          )}
        </p>
      </div>

      <Card>
        {/* ── Compact horizontal filter bar ───────────────────── */}
        <form
          action="/audit-log"
          method="get"
          className="flex flex-wrap items-center gap-2 border-b border-ink-900/8 px-4 py-3"
        >
          {/* Free-text search */}
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-900/35" />
            <Input
              name="q"
              placeholder="Search user, record, or action…"
              defaultValue={q}
              className="pl-9"
            />
          </div>

          {/* User */}
          <div className="w-40 shrink-0">
            <Select name="user" defaultValue={userId}>
              <option value="">All users</option>
              {filterOptions.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Module / entity */}
          <div className="w-36 shrink-0">
            <Select name="entity" defaultValue={entity}>
              <option value="">All modules</option>
              {filterOptions.entities.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </Select>
          </div>

          {/* Action */}
          <div className="w-36 shrink-0">
            <Select name="action" defaultValue={action}>
              <option value="">All actions</option>
              {filterOptions.actions.map((a) => (
                <option key={a} value={a}>
                  {actionLabel(a)}
                </option>
              ))}
            </Select>
          </div>

          {/* Date from */}
          <div className="w-36 shrink-0">
            <Input
              name="dateFrom"
              type="date"
              defaultValue={dateFrom}
              title="From date"
            />
          </div>

          {/* Date to */}
          <div className="w-36 shrink-0">
            <Input
              name="dateTo"
              type="date"
              defaultValue={dateTo}
              title="To date"
            />
          </div>

          <Button type="submit" variant="secondary" size="sm" className="shrink-0">
            Apply
          </Button>
        </form>

        {/* ── Table ───────────────────────────────────────────── */}
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TH>When</TH>
              <TH>User</TH>
              <TH>Action</TH>
              <TH>Module / Record</TH>
              <TH>Details</TH>
            </THead>
            <TBody>
              {items.length === 0 && (
                <EmptyRow colSpan={5}>
                  <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-ink-900/20" />
                  <p className="font-medium text-ink-900/60">No events found</p>
                  {hasFilters && (
                    <p className="mt-0.5 text-xs text-ink-900/40">
                      No activity matches your current filters.
                    </p>
                  )}
                </EmptyRow>
              )}
              {items.map((entry) => (
                <TR key={entry.id}>
                  {/* Timestamp */}
                  <TD className="whitespace-nowrap text-sm text-ink-900/70">
                    {formatDateTime(entry.createdAt)}
                  </TD>

                  {/* Actor */}
                  <TD>
                    {entry.user ? (
                      <div>
                        <p className="text-sm font-medium text-ink-900">{entry.user.name}</p>
                        {entry.user.username && (
                          <p className="text-xs text-ink-900/45">@{entry.user.username}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm italic text-ink-900/40">System</span>
                    )}
                  </TD>

                  {/* Action badge */}
                  <TD>
                    <Badge tone={actionTone(entry.action)}>
                      {actionLabel(entry.action)}
                    </Badge>
                  </TD>

                  {/* Module + record ID */}
                  <TD>
                    <p className="text-sm font-medium text-ink-900">{entry.entity}</p>
                    {entry.entityId && (
                      <p className="font-mono text-xs text-ink-900/45 truncate max-w-[140px]">
                        {entry.entityId}
                      </p>
                    )}
                  </TD>

                  {/* Change details — human-readable with raw JSON as secondary */}
                  <TD>
                    <AuditChangesCell
                      action={entry.action}
                      entity={entry.entity}
                      changes={entry.changes as Record<string, unknown> | null}
                    />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>

        <Pagination
          basePath="/audit-log"
          params={{ q, entity, action, user: userId, dateFrom, dateTo }}
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={10}
        />
      </Card>
    </div>
  );
}
