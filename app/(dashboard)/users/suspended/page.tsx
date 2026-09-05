import Link from "next/link";
import { UserX } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { listUsers } from "@/features/users/queries";
import { reactivateUserAccount } from "@/features/users/actions";
import { roleLabel } from "@/lib/permissions";
import { parsePageParam, formatDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";

type UserRow = Awaited<ReturnType<typeof listUsers>>["items"][number];

export default async function SuspendedAccountsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("MANAGE_USERS");
  const params = await searchParams;
  const page = parsePageParam(params.page);

  // Hard-filter to suspended accounts only — this page is intentionally
  // scoped; no additional filter UI is needed.
  const { items, total, totalPages } = await listUsers({
    status: "suspended",
    page,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">
          Suspended Accounts
        </h2>
        <p className="mt-1 text-sm text-ink-900/60">
          These accounts are suspended. Users cannot sign in until reactivated.
          Employee records and HR history are unaffected.
        </p>
      </div>

      <Card>
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
                  <UserX className="mx-auto mb-2 h-8 w-8 text-ink-900/20" />
                  No suspended accounts.
                </EmptyRow>
              )}
              {items.map((user: UserRow) => {
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
                      <Badge tone="warning">Suspended</Badge>
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
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </div>

        <Pagination
          basePath="/users/suspended"
          params={{}}
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={10}
        />
      </Card>
    </div>
  );
}
