import Link from "next/link";
import { Building2, Search, Plus, Users, Activity, Archive, LayoutGrid } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/permissions";
import { listCooperatives, getCooperativeCounts } from "@/features/cooperatives/queries";
import { archiveCooperative, restoreCooperative } from "@/features/cooperatives/actions";
import { parsePageParam, parseStringParam } from "@/lib/utils";
import { Card, StatCard } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, Input } from "@/components/ui/field";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { redirect } from "next/navigation";

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
  const district = parseStringParam(params.district);
  const type = parseStringParam(params.type);
  const showArchived = parseStringParam(params.archived) === "1";
  const page = parsePageParam(params.page);
  const error = parseStringParam(params.error);

  const [{ items, total, totalPages }, counts] = await Promise.all([
    listCooperatives({ q, status, district, type, showArchived, page }),
    showArchived ? null : getCooperativeCounts(),
  ]);

  return (
    <div className="space-y-6">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink-900">
            {showArchived ? "Archived Cooperatives" : "Cooperatives"}
          </h2>
          <p className="mt-1 text-sm text-ink-900/60">
            {showArchived
              ? "Archived cooperative branches. Use Restore to reactivate."
              : "Manage and maintain the union's registered primary cooperatives."}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {!showArchived && (
            <ButtonLink href="/cooperatives?archived=1" variant="outline" size="sm">
              <Archive className="h-4 w-4" />
              View archived
            </ButtonLink>
          )}
          {showArchived && (
            <ButtonLink href="/cooperatives" variant="outline" size="sm">
              ← Active cooperatives
            </ButtonLink>
          )}
          {canManage && !showArchived && (
            <ButtonLink href="/cooperatives/new" variant="primary" size="sm">
              <Plus className="h-4 w-4" />
              Add Cooperative
            </ButtonLink>
          )}
        </div>
      </div>

      {/* ── KPI cards — active view only ────────────────────────────────── */}
      {counts && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Total Cooperatives"
            value={counts.total}
            icon={<Building2 className="h-5 w-5" />}
          />
          <StatCard
            label="Active"
            value={counts.active}
            icon={<Activity className="h-5 w-5" />}
          />
          <StatCard
            label="Inactive"
            value={counts.inactive}
            icon={<LayoutGrid className="h-5 w-5" />}
          />
          <StatCard
            label="Archived"
            value={counts.archived}
            hint="Soft-deleted records"
            icon={<Archive className="h-5 w-5" />}
          />
        </div>
      )}

      {/* ── Filter bar + table ───────────────────────────────────────────── */}
      <Card>
        {/* Filter bar */}
        <form
          action="/cooperatives"
          method="get"
          className="flex flex-wrap items-center gap-2 border-b border-ink-900/8 px-4 py-3"
        >
          {/* Search */}
          <div className="relative min-w-[200px] flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-900/35"
              aria-hidden="true"
            />
            <Input
              name="q"
              placeholder="Search cooperatives…"
              defaultValue={q}
              className="pl-9"
              aria-label="Search cooperatives"
            />
          </div>

          {/* Status */}
          <div className="w-36 shrink-0">
            <Select name="status" defaultValue={status} aria-label="Filter by status">
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>

          {/* District */}
          <div className="w-36 shrink-0">
            <Input
              name="district"
              placeholder="District…"
              defaultValue={district}
              aria-label="Filter by district"
            />
          </div>

          {/* Cooperative type */}
          <div className="w-40 shrink-0">
            <Select name="type" defaultValue={type} aria-label="Filter by cooperative type">
              <option value="">All types</option>
              <option value="Agricultural">Agricultural</option>
              <option value="Savings & Credit">Savings &amp; Credit</option>
              <option value="Consumer">Consumer</option>
              <option value="Marketing">Marketing</option>
              <option value="Service">Service</option>
              <option value="Multi-Purpose">Multi-Purpose</option>
            </Select>
          </div>

          {showArchived && <input type="hidden" name="archived" value="1" />}

          <Button type="submit" variant="secondary" size="sm" className="shrink-0">
            Apply
          </Button>
        </form>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TH>Cooperative</TH>
              <TH>COOP ID</TH>
              <TH>District / Location</TH>
              <TH className="text-right">Members</TH>
              <TH className="text-right">Capital (ETB)</TH>
              <TH>Status</TH>
              {canManage && <TH className="text-right">Actions</TH>}
            </THead>
            <TBody>
              {items.length === 0 && (
                <EmptyRow colSpan={canManage ? 7 : 6}>
                  <Building2 className="mx-auto mb-2 h-8 w-8 text-ink-900/20" aria-hidden="true" />
                  No cooperatives match your filters.
                </EmptyRow>
              )}
              {items.map((coop) => {
                const capital =
                  coop.fixedAssets != null && coop.currentAssets != null
                    ? Number(coop.fixedAssets) + Number(coop.currentAssets)
                    : null;

                const districtLabel =
                  coop.district && coop.location
                    ? `${coop.district} · ${coop.location}`
                    : coop.district ?? coop.location ?? "—";

                return (
                  <TR key={coop.id}>
                    {/* Name + type */}
                    <TD>
                      <Link
                        href={`/cooperatives/${coop.id}`}
                        className="font-medium text-ink-900 hover:text-brand-700 hover:underline"
                      >
                        {coop.name}
                      </Link>
                      {coop.cooperativeType && (
                        <p className="mt-0.5 text-xs text-ink-900/45">{coop.cooperativeType}</p>
                      )}
                    </TD>

                    {/* COOP ID */}
                    <TD>
                      <span className="rounded bg-ink-900/6 px-1.5 py-0.5 font-mono text-xs text-ink-900/70">
                        {coop.cooperativeId}
                      </span>
                    </TD>

                    {/* District / Location */}
                    <TD>
                      <span className="text-sm text-ink-900/80">{districtLabel}</span>
                    </TD>

                    {/* Members */}
                    <TD className="text-right tabular-nums">
                      {coop.totalMembers != null
                        ? coop.totalMembers.toLocaleString()
                        : "—"}
                    </TD>

                    {/* Capital */}
                    <TD className="text-right tabular-nums">
                      {capital != null
                        ? capital.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : "—"}
                    </TD>

                    {/* Status */}
                    <TD>
                      <div className="flex items-center gap-1.5">
                        {coop.isActive ? (
                          <Badge tone="success">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                            Active
                          </Badge>
                        ) : (
                          <Badge tone="neutral">
                            <span className="h-1.5 w-1.5 rounded-full bg-ink-400" aria-hidden="true" />
                            Inactive
                          </Badge>
                        )}
                      </div>
                    </TD>

                    {/* Actions */}
                    {canManage && (
                      <TD className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/cooperatives/${coop.id}`}
                            className="text-sm font-medium text-brand-700 hover:underline"
                          >
                            {showArchived ? "View" : "Edit"}
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
                                size="sm"
                                confirmMessage={`Restore "${coop.name}"? It will return to the active list.`}
                                confirmLabel="Restore"
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
                                size="sm"
                                confirmMessage={`Archive "${coop.name}"? It will be hidden from the active list but all data is preserved.`}
                                confirmLabel="Archive"
                              >
                                Archive
                              </ConfirmSubmitButton>
                            </form>
                          )}
                        </div>
                      </TD>
                    )}
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </div>

        <Pagination
          basePath="/cooperatives"
          params={{
            q,
            status,
            district,
            type,
            archived: showArchived ? "1" : undefined,
          }}
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={10}
        />
      </Card>
    </div>
  );
}
