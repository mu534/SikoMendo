import Link from "next/link";
import { Users, Search, UserPlus, Activity, Clock, AlertCircle } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/permissions";
import {
  listEmployees,
  getSubordinateIds,
  getEmployeeDirectoryCounts,
} from "@/features/employees/queries";
import { listActiveDepartments } from "@/features/departments/queries";
import { archiveEmployee, restoreEmployee } from "@/features/employees/actions";
import prisma from "@/lib/prisma";
import { parsePageParam, parseStringParam, formatDate } from "@/lib/utils";
import { Card, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Select, Input } from "@/components/ui/field";
import { Button, ButtonLink } from "@/components/ui/button";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";

type EmployeeRow = Awaited<ReturnType<typeof listEmployees>>["items"][number];

const STATUS_TONE = {
  ACTIVE:      "success",
  ON_LEAVE:    "warning",
  ONBOARDING:  "brand",
  RESIGNED:    "neutral",
  RETIRED:     "neutral",
  INACTIVE:    "neutral",
  SUSPENDED:   "warning",
  TERMINATED:  "danger",
} as const;

const STATUS_LABEL: Record<string, string> = {
  ACTIVE:      "Active",
  ON_LEAVE:    "On Leave",
  ONBOARDING:  "Onboarding",
  RESIGNED:    "Resigned",
  RETIRED:     "Retired",
  INACTIVE:    "Inactive",
  SUSPENDED:   "Suspended",
  TERMINATED:  "Terminated",
};

const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  PERMANENT:   "Permanent",
  CONTRACT:    "Contract",
  TEMPORARY:   "Temporary",
  PROBATION:   "Probation",
  INTERNSHIP:  "Internship",
};

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("VIEW_EMPLOYEES");
  const canManage = can(session.user.role, "MANAGE_EMPLOYEES");

  const params = await searchParams;
  const q              = parseStringParam(params.q);
  const status         = parseStringParam(params.status);
  const departmentId   = parseStringParam(params.department);
  const employmentType = parseStringParam(params.employmentType);
  const showArchived   = parseStringParam(params.archived) === "1";
  const page           = parsePageParam(params.page);

  // Managers only see employees within their own reporting hierarchy
  let restrictToIds: string[] | undefined;
  if (session.user.role === "MANAGER") {
    const ownEmployee = await prisma.employee.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    restrictToIds = ownEmployee ? await getSubordinateIds(ownEmployee.id) : [];
  }

  const [{ items, total, totalPages }, departments, counts] = await Promise.all([
    listEmployees({ q, status, departmentId, employmentType, showArchived, restrictToIds, page }),
    listActiveDepartments(),
    // KPI counts only shown when not in archived view (archived employees are excluded from counts)
    showArchived
      ? Promise.resolve(null)
      : getEmployeeDirectoryCounts(restrictToIds),
  ]);

  return (
    <div className="space-y-6">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink-900">
            {showArchived ? "Archived Employees" : "Employees"}
          </h2>
          <p className="mt-1 text-sm text-ink-900/55">
            {showArchived
              ? "Archived employee records. Restore to make them active again."
              : "Manage employee records and employment lifecycle."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!showArchived && (
            <ButtonLink
              href="/employees?archived=1"
              variant="outline"
              size="sm"
            >
              View archived
            </ButtonLink>
          )}
          {showArchived && (
            <ButtonLink href="/employees" variant="outline" size="sm">
              ← Active employees
            </ButtonLink>
          )}
          {canManage && !showArchived && (
            <ButtonLink href="/employees/new" variant="primary" size="sm">
              <UserPlus className="h-4 w-4" />
              New Employee
            </ButtonLink>
          )}
        </div>
      </div>

      {/* ── KPI cards — only shown on the active (non-archived) view ── */}
      {counts && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Total Employees"
            value={counts.total}
            icon={<Users className="h-5 w-5" />}
          />
          <StatCard
            label="Active"
            value={counts.active}
            icon={<Activity className="h-5 w-5" />}
          />
          <StatCard
            label="Onboarding"
            value={counts.onboarding}
            hint="In pre-boarding checklist"
            icon={<UserPlus className="h-5 w-5" />}
          />
          <StatCard
            label="On Leave"
            value={counts.onLeave}
            icon={<Clock className="h-5 w-5" />}
          />
        </div>
      )}

      {/* ── Filter bar + table ────────────────────────────────────────── */}
      <Card>

        {/* Filter bar */}
        <form
          action="/employees"
          method="get"
          className="flex flex-wrap items-center gap-2 border-b border-ink-900/8 px-4 py-3"
        >
          {/* Search */}
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-900/35" />
            <Input
              name="q"
              placeholder="Search by name, ID, department…"
              defaultValue={q}
              className="pl-9"
            />
          </div>

          {/* Department */}
          <div className="w-44 shrink-0">
            <Select name="department" defaultValue={departmentId}>
              <option value="">All departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </Select>
          </div>

          {/* Status */}
          <div className="w-36 shrink-0">
            <Select name="status" defaultValue={status}>
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="ONBOARDING">Onboarding</option>
              <option value="ON_LEAVE">On Leave</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="RESIGNED">Resigned</option>
              <option value="RETIRED">Retired</option>
              <option value="TERMINATED">Terminated</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </div>

          {/* Employment type */}
          <div className="w-36 shrink-0">
            <Select name="employmentType" defaultValue={employmentType}>
              <option value="">All types</option>
              <option value="PERMANENT">Permanent</option>
              <option value="CONTRACT">Contract</option>
              <option value="TEMPORARY">Temporary</option>
              <option value="PROBATION">Probation</option>
              <option value="INTERNSHIP">Internship</option>
            </Select>
          </div>

          {/* Preserve archived param */}
          {showArchived && <input type="hidden" name="archived" value="1" />}

          <Button type="submit" variant="secondary" size="sm" className="shrink-0">
            Filter
          </Button>

          {/* Clear link — only show when filters are active */}
          {(q || status || departmentId || employmentType) && (
            <ButtonLink
              href={showArchived ? "/employees?archived=1" : "/employees"}
              variant="ghost"
              size="sm"
              className="shrink-0 text-ink-900/45"
            >
              Clear
            </ButtonLink>
          )}
        </form>

        {/* Results summary */}
        {total > 0 && (
          <div className="border-b border-ink-900/6 px-6 py-2.5">
            <p className="text-xs text-ink-900/45">
              {total === 1 ? "1 employee" : `${total} employees`}
              {(q || status || departmentId || employmentType) && " matching filters"}
            </p>
          </div>
        )}

        {/* Table */}
        <Table>
          <THead>
            <TH>Employee</TH>
            <TH className="hidden sm:table-cell">Department · Position</TH>
            <TH className="hidden md:table-cell">Manager</TH>
            <TH className="hidden lg:table-cell">Type</TH>
            <TH>Status</TH>
            <TH className="hidden xl:table-cell">Hired</TH>
            {canManage && <TH className="text-right">Actions</TH>}
          </THead>
          <TBody>
            {items.length === 0 && (
              <EmptyRow colSpan={canManage ? 7 : 6}>
                <div className="flex flex-col items-center gap-2">
                  <Users className="h-8 w-8 text-ink-900/20" />
                  <span>
                    {q || status || departmentId || employmentType
                      ? "No employees match your filters."
                      : showArchived
                        ? "No archived employees."
                        : "No employees yet."}
                  </span>
                  {canManage && !showArchived && !q && !status && !departmentId && !employmentType && (
                    <ButtonLink href="/employees/new" variant="secondary" size="sm" className="mt-1">
                      <UserPlus className="h-4 w-4" />
                      Add first employee
                    </ButtonLink>
                  )}
                </div>
              </EmptyRow>
            )}
            {items.map((emp: EmployeeRow) => {
              const fullName = `${emp.firstName}${emp.middleName ? ` ${emp.middleName}` : ""} ${emp.lastName}`;
              const statusTone = STATUS_TONE[emp.employmentStatus as keyof typeof STATUS_TONE] ?? "neutral";
              const managerName = emp.manager
                ? `${emp.manager.firstName} ${emp.manager.lastName}`
                : null;

              return (
                <TR key={emp.id}>
                  {/* Employee */}
                  <TD>
                    <Link
                      href={`/employees/${emp.id}`}
                      className="flex items-center gap-3 group"
                    >
                      <Avatar
                        name={fullName}
                        imageUrl={emp.profileImageUrl}
                        size="sm"
                        className="shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink-900 group-hover:text-brand-700 transition-colors">
                          {fullName}
                        </p>
                        <p className="text-xs text-ink-900/45">{emp.employeeId}</p>
                      </div>
                    </Link>
                  </TD>

                  {/* Department / Position */}
                  <TD className="hidden sm:table-cell">
                    <p className="text-sm text-ink-900/80">
                      {emp.position?.name ?? <span className="text-ink-900/35">No position</span>}
                    </p>
                    <p className="text-xs text-ink-900/45">
                      {emp.department?.name ?? "—"}
                    </p>
                  </TD>

                  {/* Manager */}
                  <TD className="hidden md:table-cell">
                    {managerName ? (
                      <span className="text-sm text-ink-900/70">{managerName}</span>
                    ) : (
                      <span className="text-sm text-ink-900/30">—</span>
                    )}
                  </TD>

                  {/* Employment type */}
                  <TD className="hidden lg:table-cell">
                    <span className="text-sm text-ink-900/70">
                      {EMPLOYMENT_TYPE_LABEL[emp.employmentType ?? ""] ?? "—"}
                    </span>
                  </TD>

                  {/* Status */}
                  <TD>
                    <Badge tone={statusTone}>
                      {STATUS_LABEL[emp.employmentStatus] ?? emp.employmentStatus}
                    </Badge>
                  </TD>

                  {/* Hired */}
                  <TD className="hidden xl:table-cell text-sm text-ink-900/55">
                    {formatDate(emp.hireDate)}
                  </TD>

                  {/* Actions */}
                  {canManage && (
                    <TD className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/employees/${emp.id}`}
                          className="text-sm font-medium text-brand-700 hover:underline"
                        >
                          View
                        </Link>
                        {showArchived ? (
                          <form action={async () => { "use server"; await restoreEmployee(emp.id); }}>
                            <ConfirmSubmitButton
                              variant="outline"
                              size="sm"
                              confirmMessage={`Restore ${fullName}? They will return to their previous employment status.`}
                            >
                              Restore
                            </ConfirmSubmitButton>
                          </form>
                        ) : (
                          <form action={async () => { "use server"; await archiveEmployee(emp.id); }}>
                            <ConfirmSubmitButton
                              variant="ghost"
                              size="sm"
                              confirmMessage={`Archive ${fullName}? You can restore this record later.`}
                              className="text-ink-900/40 hover:text-red-600"
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

        {/* Pagination */}
        {totalPages > 1 && (
          <Pagination
            basePath="/employees"
            params={{
              q,
              status,
              department: departmentId,
              employmentType,
              archived: showArchived ? "1" : undefined,
            }}
            page={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={10}
          />
        )}
      </Card>
    </div>
  );
}
