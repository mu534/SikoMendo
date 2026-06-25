import Link from "next/link";
import { Plus, Building2, ArchiveRestore } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/permissions";
import { listCooperatives } from "@/features/cooperatives/queries";
import { archiveCooperative, restoreCooperative } from "@/features/cooperatives/actions";
import { parsePageParam, parseStringParam } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/field";
import { Toolbar } from "@/components/ui/toolbar";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { redirect } from "next/navigation";
import type { Cooperative } from "@prisma/client";

type CooperativeRow = Cooperative & { _count: { employees: number } };

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
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink-900">Cooperatives</h2>
          <p className="mt-1 text-sm text-ink-900/60">
            {showArchived ? "Archived cooperative branches." : "All cooperative branches under Siko Mendo Union."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ButtonLink href={showArchived ? "/cooperatives" : "/cooperatives?archived=1"} variant="outline">
            <ArchiveRestore className="h-4 w-4" />
            {showArchived ? "Back to active" : "View archived"}
          </ButtonLink>
          {canManage && !showArchived && (
            <ButtonLink href="/cooperatives/new">
              <Plus className="h-4 w-4" />
              New cooperative
            </ButtonLink>
          )}
        </div>
      </div>

      <Card>
        <Toolbar basePath="/cooperatives" searchPlaceholder="Search by name, ID, or location" searchDefault={q}>
          <Select name="status" defaultValue={status} className="w-40">
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
          {showArchived && <input type="hidden" name="archived" value="1" />}
        </Toolbar>

        <Table>
          <THead>
            <TH>Cooperative</TH>
            <TH>Location</TH>
            <TH>Contact</TH>
            <TH>Employees</TH>
            <TH>Status</TH>
            {canManage && <TH className="text-right">Actions</TH>}
          </THead>
          <TBody>
            {items.length === 0 && (
              <EmptyRow colSpan={canManage ? 6 : 5}>
                <Building2 className="mx-auto mb-2 h-8 w-8 text-ink-900/20" />
                No cooperatives match your filters.
              </EmptyRow>
            )}
            {items.map((coop: CooperativeRow) => (
              <TR key={coop.id}>
                <TD>
                  <Link href={`/cooperatives/${coop.id}`} className="font-medium text-ink-900 hover:underline">
                    {coop.name}
                  </Link>
                  <p className="text-xs text-ink-900/50">{coop.cooperativeId}</p>
                </TD>
                <TD>{coop.location ?? "—"}</TD>
                <TD>
                  <p className="text-ink-900/80">{coop.contactPerson ?? "—"}</p>
                  <p className="text-xs text-ink-900/50">{coop.contactPhone ?? coop.contactEmail ?? ""}</p>
                </TD>
                <TD>{coop._count.employees}</TD>
                <TD>{coop.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Inactive</Badge>}</TD>
                {canManage && (
                  <TD className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/cooperatives/${coop.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                        Edit
                      </Link>
                      {showArchived ? (
                        <form
                          action={async () => {
                            "use server";
                            await restoreCooperative(coop.id);
                          }}
                        >
                          <ConfirmSubmitButton variant="outline" confirmMessage={`Restore ${coop.name}?`}>
                            Restore
                          </ConfirmSubmitButton>
                        </form>
                      ) : (
                        <form
                          action={async () => {
                            "use server";
                            const result = await archiveCooperative(coop.id);
                            if (!result.success) {
                              redirect(`/cooperatives?error=${encodeURIComponent(result.error.message)}`);
                            }
                          }}
                        >
                          <ConfirmSubmitButton confirmMessage={`Archive ${coop.name}?`}>Archive</ConfirmSubmitButton>
                        </form>
                      )}
                    </div>
                  </TD>
                )}
              </TR>
            ))}
          </TBody>
        </Table>

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
