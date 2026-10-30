import Link from "next/link";
import { Search, Users as UsersIcon } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { listUsers } from "@/features/users/queries";
import { suspendUserAccount, reactivateUserAccount } from "@/features/users/actions";
import { roleLabel, ROLES } from "@/lib/permissions";
import { parsePageParam, parseStringParam, formatDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Select, Input } from "@/components/ui/field";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";

type UserRow = Awaited<ReturnType<typeof listUsers>>["items"][number];

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("MANAGE_USERS");
  const params = await searchParams;
  const q = parseStringParam(params.q);
  const role = parseStringParam(params.role);
  const status = parseStringParam(params.status);
  const page = parsePageParam(params.page);

  const { items, total, totalPages } = await listUsers({ q, role, status, page });

  return (
    <div className="space-y-6">
      {/* ── Page header ─────────────────────────────────────────────── */}
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">All Accounts</h2>
        <p className="mt-1 text-sm text-ink-900/60">
          Manage system accounts, roles, and access to Siko Mendo HRMIS.
        </p>
      </div>

      <Card>
        {/* ── Compact horizontal filter bar ───────────────────────── */}
        <form
          action="/users"
          method="get"
          className="flex flex-wrap items-center gap-2 border-b border-ink-900/8 px-4 py-3"
        >
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-900/35" />
            <Input
              name="q"
              placeholder="Search by name, username, or employee ID…"
              defaultValue={q}
              className="pl-9"
            />
          </div>
          <div className="w-36 shrink-0">
            <Select name="role" defaultValue={role}>
              <option value="">All roles</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-36 shrink-0">
            <Select name="status" defaultValue={status}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </Select>
          </div>
          <Button type="submit" variant="secondary" size="sm" className="shrink-0">
            Apply
          </Button>
        </form>

        {/* ── Table ───────────────────────────────────────────────── */}
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TH>Account</TH>
              <TH>Employee</TH>
              <TH>Role</TH>
              <TH>Status</TH>
              <TH>Created</TH>
              <TH className="text-right">Actions</TH>
            </THead>
            <TBody>
              {items.length === 0 && (
                <EmptyRow colSpan={6}>
                  <UsersIcon className="mx-auto mb-2 h-8 w-8 text-ink-900/20" />
                  No user accounts match your filters.
                </EmptyRow>
              )}
              {items.map((user: UserRow) => {
                const isSelf = user.id === session.user.id;
                const emp = user.employee;

                return (
                  <TR key={user.id}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <Avatar name={user.name} imageUrl={user.image} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink-900">{user.name}</p>
                          <p className="text-xs text-ink-900/50">
                            {user.username
                              ? `@${user.username}`
                              : <span className="italic">no username</span>}
                          </p>
                        </div>
                      </div>
                    </TD>

                    <TD>
                      {emp ? (
                        <Link
                          href={`/employees/${emp.id}`}
                          className="text-sm font-medium text-brand-700 hover:underline"
                        >
                          {emp.firstName} {emp.lastName}
                          <span className="ml-1 font-normal text-ink-900/45">
                            ({emp.employeeId})
                          </span>
                        </Link>
                      ) : (
                        <span className="text-sm italic text-ink-900/40">Not linked</span>
                      )}
                      {emp?.deletedAt && (
                        <span className="ml-2 text-xs text-ink-900/40">(archived)</span>
                      )}
                    </TD>

                    <TD>
                      <Badge tone="brand">{roleLabel(user.role)}</Badge>
                    </TD>

                    <TD>
                      {user.banned
                        ? <Badge tone="warning">Suspended</Badge>
                        : <Badge tone="success">Active</Badge>}
                    </TD>

                    <TD className="whitespace-nowrap text-sm text-ink-900/60">
                      {formatDate(user.createdAt)}
                    </TD>

                    <TD className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/users/${user.id}`}
                          className="text-sm font-medium text-brand-700 hover:underline"
                        >
                          Edit
                        </Link>
                        {!isSelf && (
                          user.banned ? (
                            <form
                              action={async () => {
                                "use server";
                                await reactivateUserAccount(user.id);
                              }}
                            >
                              <ConfirmSubmitButton
                                variant="outline"
                                size="sm"
                                confirmMessage={`Reactivate ${user.name}'s account? They will be able to sign in again.`}
                              >
                                Reactivate
                              </ConfirmSubmitButton>
                            </form>
                          ) : (
                            <form
                              action={async () => {
                                "use server";
                                await suspendUserAccount(user.id);
                              }}
                            >
                              <ConfirmSubmitButton
                                variant="outline"
                                size="sm"
                                confirmMessage={`Suspend ${user.name}'s account? They won't be able to sign in.`}
                              >
                                Suspend
                              </ConfirmSubmitButton>
                            </form>
                          )
                        )}
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </div>

        <Pagination
          basePath="/users"
          params={{ q, role, status }}
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={10}
        />
      </Card>
    </div>
  );
}
