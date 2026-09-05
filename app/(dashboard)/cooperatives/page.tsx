import Link from "next/link";
import { Building2, Search } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/permissions";
import { listCooperatives } from "@/features/cooperatives/queries";
import { archiveCooperative, restoreCooperative } from "@/features/cooperatives/actions";
import { parsePageParam, parseStringParam } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, Input } from "@/components/ui/field";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { redirect } from "next/navigation";
import type { Cooperative } from "@prisma/client";

type CooperativeRow = Cooperative;

export default async function CooperativesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("VIEW_COOPERATIVES");
  const canManage = can(session.user.role, "MANAGE_COOPERATIVES");

  const params = await searchParams;
  const q = parseStringParam(params.q);
  const status = parseStringParam(params.status);
  const showArchived = parseStringParam(params.archived) === "1";
  const page = parsePageParam(params.page);
  const error = parseStringParam(params.error);

  const { items, total, totalPages } = await listCooperatives({ q, status, showArchived, page });

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">
          {showArchived ? "Archived Cooperatives" : "Cooperative List"}
        </h2>
        <p className="mt-1 text-sm text-ink-900/60">
          {showArchived
            ? "Archived cooperative branches. Use Restore to reactivate."
            : "All cooperative branches under Siko Mendo Union."}
        </p>
      </div>

      <Card>
        {/* ── Compact horizontal filter bar ───────────────────────── */}
        <form
          action="/cooperatives"
          method="get"
          className="flex flex-wrap items-center gap-2 border-b border-ink-900/8 px-4 py-3"
        >
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-900/35" />
            <Input
              name="q"
              placeholder="Search by name, ID, or location…"
              defaultValue={q}
              className="pl-9"
            />
          </div>
          <div className="w-36 shrink-0">
            <Select name="status" defaultValue={status}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>
          {showArchived && <input type="hidden" name="archived" value="1" />}
          <Button type="submit" variant="secondary" size="sm" className="shrink-0">
            Apply
          </Button>
        </form>

        {/* ── Table ───────────────────────────────────────────────── */}
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TH>Cooperative</TH>
              <TH>Location</TH>
              <TH>Contact</TH>
              <TH>Status</TH>
              {canManage && <TH className="text-right">Actions</TH>}
            </THead>
            <TBody>
              {items.length === 0 && (
                <EmptyRow colSpan={canManage ? 5 : 4}>
                  <Building2 className="mx-auto mb-2 h-8 w-8 text-ink-900/20" />
                  No cooperatives match your filters.
                </EmptyRow>
              )}
              {items.map((coop: CooperativeRow) => (
                <TR key={coop.id}>
                  <TD>
                    <Link
                      href={`/cooperatives/${coop.id}`}
                      className="font-medium text-ink-900 hover:underline"
                    >
                      {coop.name}
                    </Link>
                    <p className="text-xs text-ink-900/50">{coop.cooperativeId}</p>
                  </TD>
                  <TD>{coop.location ?? "—"}</TD>
                  <TD>
                    <p className="text-ink-900/80">{coop.contactPerson ?? "—"}</p>
                    <p className="text-xs text-ink-900/50">
                      {coop.contactPhone ?? coop.contactEmail ?? ""}
                    </p>
                  </TD>
                  <TD>
                    {coop.isActive
                      ? <Badge tone="success">Active</Badge>
                      : <Badge tone="neutral">Inactive</Badge>}
                  </TD>
                  {canManage && (
                    <TD className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/cooperatives/${coop.id}`}
                          className="text-sm font-medium text-brand-700 hover:underline"
                        >
                          Edit
                        </Link>
                        {showArchived ? (
                          <form
                            action={async () => {
                              "use server";
                              await restoreCooperative(coop.id);
                            }}
                          >
                            <ConfirmSubmitButton
                              variant="outline"
                              confirmMessage={`Restore ${coop.name}?`}
                            >
                              Restore
                            </ConfirmSubmitButton>
                          </form>
                        ) : (
                          <form
                            action={async () => {
                              "use server";
                              const result = await archiveCooperative(coop.id);
                              if (!result.success) {
                                redirect(
                                  `/cooperatives?error=${encodeURIComponent(result.error.message)}`
                                );
                              }
                            }}
                          >
                            <ConfirmSubmitButton
                              confirmMessage={`Archive ${coop.name}?`}
                            >
                              Archive
                            </ConfirmSubmitButton>
                          </form>
                        )}
                      </div>
                    </TD>
                  )}
                </TR>
              ))}
            </TBody>
          </Table>
        </div>

        <Pagination
          basePath="/cooperatives"
          params={{ q, status, archived: showArchived ? "1" : undefined }}
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={10}
        />
      </Card>
    </div>
  );
}
