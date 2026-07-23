import Link from "next/link";
import { UserPlus, Users as UsersIcon, ArchiveRestore } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/permissions";
import { listEmployees, listAssignableCooperatives } from "@/features/employees/queries";
import { archiveEmployee, restoreEmployee } from "@/features/employees/actions";
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
import type { Employee, Prisma } from "@prisma/client";

type EmployeeRow = Prisma.EmployeeGetPayload<{ include: { cooperative: { select: { name: true } } } }>;
type CooperativeOption = { id: string; name: string };

const STATUS_TONE = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  SUSPENDED: "warning",
  TERMINATED: "danger",
} as const;

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("VIEW_EMPLOYEES");
  const canManage = can(session.user.role, "MANAGE_EMPLOYEES");

  const params = await searchParams;
  const q = parseStringParam(params.q);
  const status = parseStringParam(params.status);
  const cooperativeId = parseStringParam(params.cooperativeId);
  const showArchived = parseStringParam(params.archived) === "1";
  const page = parsePageParam(params.page);

  const [{ items, total, totalPages }, cooperatives] = await Promise.all([
    listEmployees({ q, status, cooperativeId, showArchived, page }),
    listAssignableCooperatives(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink-900">Employee records</h2>
          <p className="mt-1 text-sm text-ink-900/60">
            {showArchived ? "Archived employee records." : "All active employee records across Siko Mendo Union."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ButtonLink href={showArchived ? "/employees" : "/employees?archived=1"} variant="outline">
            <ArchiveRestore className="h-4 w-4" />
            {showArchived ? "Back to active" : "View archived"}
          </ButtonLink>
          {canManage && !showArchived && (
            <ButtonLink href="/employees/new">
              <UserPlus className="h-4 w-4" />
              New employee
            </ButtonLink>
          )}
        </div>
      </div>

      <Card>
        <Toolbar basePath="/employees" searchPlaceholder="Search by name, ID, or email" searchDefault={q}>
          <Select name="status" defaultValue={status} className="w-44">
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="TERMINATED">Terminated</option>
          </Select>
          <Select name="cooperativeId" defaultValue={cooperativeId} className="w-56">
            <option value="">All cooperatives</option>
            {cooperatives.map((c: CooperativeOption) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          {showArchived && <input type="hidden" name="archived" value="1" />}
        </Toolbar>

        <Table>
          <THead>
            <TH>Employee</TH>
            <TH>Department / Position</TH>
            <TH>Cooperative</TH>
            <TH>Status</TH>
            <TH>Hired</TH>
            {canManage && <TH className="text-right">Actions</TH>}
          </THead>
          <TBody>
            {items.length === 0 && (
              <EmptyRow colSpan={canManage ? 6 : 5}>
                <UsersIcon className="mx-auto mb-2 h-8 w-8 text-ink-900/20" />
                No employee records match your filters.
              </EmptyRow>
            )}
            {items.map((employee: EmployeeRow) => (
              <TR key={employee.id}>
                <TD>
                  <Link href={`/employees/${employee.id}`} className="flex items-center gap-3">
                    <Avatar name={`${employee.firstName} ${employee.lastName}`} imageUrl={employee.profileImageUrl} size="sm" />
                    <div>
                      <p className="font-medium text-ink-900">
                        {employee.firstName} {employee.lastName}
                      </p>
                      <p className="text-xs text-ink-900/50">{employee.employeeId}</p>
                    </div>
                  </Link>
                </TD>
                <TD>
                  <p className="text-ink-900/80">{employee.position ?? "—"}</p>
                  <p className="text-xs text-ink-900/50">{employee.department ?? "—"}</p>
                </TD>
                <TD>{employee.cooperative?.name ?? "—"}</TD>
                <TD>
                  <Badge tone={STATUS_TONE[employee.employmentStatus as keyof typeof STATUS_TONE]}>
                    {employee.employmentStatus}
                  </Badge>
                </TD>
                <TD>{formatDate(employee.hireDate)}</TD>
                {canManage && (
                  <TD className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/employees/${employee.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                        Edit
                      </Link>
                      {showArchived ? (
                        <form
                          action={async () => {
                            "use server";
                            await restoreEmployee(employee.id);
                          }}
                        >
                          <ConfirmSubmitButton
                            variant="outline"
                            confirmMessage={`Restore ${employee.firstName} ${employee.lastName}?`}
                          >
                            Restore
                          </ConfirmSubmitButton>
                        </form>
                      ) : (
                        <form
                          action={async () => {
                            "use server";
                            await archiveEmployee(employee.id);
                          }}
                        >
                          <ConfirmSubmitButton
                            confirmMessage={`Archive ${employee.firstName} ${employee.lastName}? You can restore this later.`}
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

        <Pagination
          basePath="/employees"
          params={{ q, status, cooperativeId, archived: showArchived ? "1" : undefined }}
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={10}
        />
      </Card>
    </div>
  );
}
