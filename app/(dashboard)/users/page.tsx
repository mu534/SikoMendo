import Link from "next/link";
import { UserPlus, Users as UsersIcon } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { listUsers } from "@/features/users/queries";
import { toggleUserBan, deleteUserAccount } from "@/features/users/actions";
import { roleLabel, ROLES } from "@/lib/permissions";
import type { User } from "@prisma/client";
import { parsePageParam, parseStringParam, formatDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Select } from "@/components/ui/field";
import { Toolbar } from "@/components/ui/toolbar";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("MANAGE_USERS");
  const params = await searchParams;
  const q = parseStringParam(params.q);
  const role = parseStringParam(params.role);
  const page = parsePageParam(params.page);

  const { items, total, totalPages } = await listUsers({ q, role, page });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink-900">User accounts</h2>
          <p className="mt-1 text-sm text-ink-900/60">Create accounts and assign roles for staff who need system access.</p>
        </div>
        <ButtonLink href="/users/new">
          <UserPlus className="h-4 w-4" />
          New user
        </ButtonLink>
      </div>

      <Card>
        <Toolbar basePath="/users" searchPlaceholder="Search by name or username" searchDefault={q}>
          <Select name="role" defaultValue={role} className="w-44">
            <option value="">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </Select>
        </Toolbar>

        <Table>
          <THead>
            <TH>Name</TH>
            <TH>Role</TH>
            <TH>Status</TH>
            <TH>Joined</TH>
            <TH className="text-right">Actions</TH>
          </THead>
          <TBody>
            {items.length === 0 && (
              <EmptyRow colSpan={5}>
                <UsersIcon className="mx-auto mb-2 h-8 w-8 text-ink-900/20" />
                No users match your filters.
              </EmptyRow>
            )}
            {items.map((user: User) => (
              <TR key={user.id}>
                <TD>
                  <div className="flex items-center gap-3">
                    <Avatar name={user.name} imageUrl={user.image} size="sm" />
                    <div>
                      <p className="font-medium text-ink-900">{user.name}</p>
                      <p className="text-xs text-ink-900/50">
                        {user.username ? `@${user.username}` : <span className="italic">no username</span>}
                      </p>
                    </div>
                  </div>
                </TD>
                <TD>
                  <Badge tone="brand">{roleLabel(user.role)}</Badge>
                </TD>
                <TD>
                  {user.banned ? <Badge tone="danger">Banned</Badge> : <Badge tone="success">Active</Badge>}
                </TD>
                <TD>{formatDate(user.createdAt)}</TD>
                <TD className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link href={`/users/${user.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                      Edit
                    </Link>
                    {user.id !== session.user.id && (
                      <>
                        <form
                          action={async () => {
                            "use server";
                            await toggleUserBan(user.id, !user.banned);
                          }}
                        >
                          <ConfirmSubmitButton
                            variant="outline"
                            confirmMessage={
                              user.banned ? `Unban ${user.name}?` : `Ban ${user.name}? They won't be able to sign in.`
                            }
                          >
                            {user.banned ? "Unban" : "Ban"}
                          </ConfirmSubmitButton>
                        </form>
                        <form
                          action={async () => {
                            "use server";
                            await deleteUserAccount(user.id);
                          }}
                        >
                          <ConfirmSubmitButton confirmMessage={`Delete ${user.name}? This cannot be undone.`}>
                            Delete
                          </ConfirmSubmitButton>
                        </form>
                      </>
                    )}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>

        <Pagination basePath="/users" params={{ q, role }} page={page} totalPages={totalPages} totalItems={total} pageSize={10} />
      </Card>
    </div>
  );
}
