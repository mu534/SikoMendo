import Link from "next/link";
import { Plus, Search, Users, X } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { can, type Role } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import {
  listAllLeaveRequests,
  getMyLeaveRequests,
  listEmployeesForLeaveFilter,
  getEmployeeLeaveBalances,
} from "@/features/leave/queries";
import { LeaveStatusBadge } from "@/features/leave/leave-status-badge";
import {
  LEAVE_TYPE_LABELS,
  LEAVE_TYPES,
  LEAVE_STATUSES,
  LEAVE_STATUS_LABELS,
} from "@/features/leave/schemas";
import { parsePageParam, parseStringParam, formatDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Select, Input } from "@/components/ui/field";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";

export default async function LeavePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const params = await searchParams;

  if (can(session.user.role, "VIEW_ALL_LEAVE")) {
    const role = session.user.role as Role;
    return <AllLeaveRequests params={params} role={role} userId={session.user.id} />;
  }

  return <MyLeaveRequests userId={session.user.id} params={params} />;
}

// ── Manager / HR: all leave requests ─────────────────────────────────────────

async function AllLeaveRequests({
  params,
  role,
  userId,
}: {
  params: Record<string, string | string[] | undefined>;
  role: Role;
  userId: string;
}) {
  const t  = await getTranslations("leave");
  const tC = await getTranslations("common");

  const q           = parseStringParam(params.q);
  const status      = parseStringParam(params.status);
  const leaveType   = parseStringParam(params.type);
  const employeeId  = parseStringParam(params.employee);
  const sort        = parseStringParam(params.sort);
  const page        = parsePageParam(params.page);

  // Whether any filter is active — used to offer a "Clear filters" link
  const hasFilters = !!(q || status || leaveType || employeeId || sort);

  let managerEmployeeId: string | undefined;
  let managerHasNoEmployeeRecord = false;
  // MANAGER = General Manager: org-wide authority — do NOT scope to direct reports.
  // Only other roles that might have MANAGE_LEAVE in the future would be scoped.
  // Currently MANAGE_LEAVE is MANAGER-only, so this block is effectively a no-op
  // for the GM, but left here for clarity and future-proofing.
  if (role !== "MANAGER" && role !== "ADMIN" && role !== "HR_OFFICER") {
    const managerEmployee = await prisma.employee.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (managerEmployee) {
      managerEmployeeId = managerEmployee.id;
    } else {
      managerHasNoEmployeeRecord = true;
    }
  }

  if (managerHasNoEmployeeRecord) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink-900">{t("title")}</h2>
          <p className="mt-1 text-sm text-ink-900/60">
            {t("managerDescription")}
          </p>
        </div>
        <Card className="p-8 text-center">
          <Users className="mx-auto mb-3 h-8 w-8 text-ink-900/20" />
          <p className="font-medium text-ink-900">{t("noLinkedForManager")}</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-900/55">
            {t("noLinkedForManagerDesc")}
          </p>
        </Card>
      </div>
    );
  }

  const [{ items, total, totalPages }, employees] = await Promise.all([
    listAllLeaveRequests({ q, status, leaveType, employeeId, sort, page, managerEmployeeId }),
    listEmployeesForLeaveFilter(managerEmployeeId),
  ]);

  return (
    <div className="space-y-5">
      {/* ── Page header ──────────────────────────────────────────── */}
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">{t("title")}</h2>
        <p className="mt-1 text-sm text-ink-900/60">
          {role === "MANAGER"
            ? t("managerDescription")
            : t("hrDescription")}
        </p>
      </div>

      <Card>
        {/* ── Compact horizontal filter bar ────────────────────── */}
        <form
          action="/leave"
          method="get"
          className="flex flex-wrap items-center gap-2 border-b border-ink-900/8 px-4 py-3"
        >
          {/* Search — takes all remaining space */}
          <div className="relative min-w-[160px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-900/35" />
            <Input
              name="q"
              placeholder={t("filters.searchPlaceholder")}
              defaultValue={q}
              className="pl-9"
            />
          </div>

          {/* Employee */}
          <div className="w-36 shrink-0">
            <Select name="employee" defaultValue={employeeId}>
              <option value="">{t("filters.allEmployees")}</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.firstName} {e.lastName}
                </option>
              ))}
            </Select>
          </div>

          {/* Leave type */}
          <div className="w-36 shrink-0">
            <Select name="type" defaultValue={leaveType}>
              <option value="">{t("filters.allTypes")}</option>
              {LEAVE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {LEAVE_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>

          {/* Status */}
          <div className="w-32 shrink-0">
            <Select name="status" defaultValue={status}>
              <option value="">{t("filters.allStatuses")}</option>
              {LEAVE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {LEAVE_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>

          {/* Sort */}
          <div className="w-32 shrink-0">
            <Select name="sort" defaultValue={sort}>
              <option value="">{t("filters.newestFirst")}</option>
              <option value="oldest">{t("filters.oldestFirst")}</option>
              <option value="start_date">{t("filters.startDate")}</option>
            </Select>
          </div>

          <Button type="submit" variant="secondary" size="sm" className="shrink-0">
            {tC("apply")}
          </Button>

          {/* Clear filters — only when something is active */}
          {hasFilters && (
            <Link
              href="/leave"
              className="inline-flex shrink-0 items-center gap-1 text-sm text-ink-900/50 hover:text-ink-900"
              title="Clear all filters"
            >
              <X className="h-3.5 w-3.5" />
              {tC("clear")}
            </Link>
          )}
        </form>

        {/* ── Table ────────────────────────────────────────────── */}
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TH>{t("columns.employee")}</TH>
              <TH>{t("columns.leaveType")}</TH>
              <TH>{t("columns.period")}</TH>
              <TH>{t("columns.days")}</TH>
              <TH>{t("columns.status")}</TH>
              <TH>{t("columns.applied")}</TH>
              <TH className="text-right">{t("columns.action")}</TH>
            </THead>
            <TBody>
              {items.length === 0 ? (
                <EmptyRow colSpan={7}>
                  <div className="py-2 text-center">
                    <p className="font-medium text-ink-900/60">{t("noRequestsFiltered")}</p>
                    <p className="mt-0.5 text-xs text-ink-900/40">
                      {t("noRequestsFilteredDesc")}
                    </p>
                    {hasFilters && (
                      <Link
                        href="/leave"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                      >
                        <X className="h-3 w-3" />
                        {tC("clearFilters")}
                      </Link>
                    )}
                  </div>
                </EmptyRow>
              ) : (
                items.map((leave) => (
                  <TR key={leave.id}>
                    {/* Employee */}
                    <TD>
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          name={`${leave.employee.firstName} ${leave.employee.lastName}`}
                          imageUrl={leave.employee.profileImageUrl}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink-900">
                            {leave.employee.firstName} {leave.employee.lastName}
                          </p>
                          <p className="text-xs text-ink-900/45">{leave.employee.employeeId}</p>
                        </div>
                      </div>
                    </TD>

                    {/* Leave type + ID */}
                    <TD>
                      <p className="font-medium text-ink-900/85">
                        {LEAVE_TYPE_LABELS[leave.leaveType]}
                      </p>
                      <p className="text-xs text-ink-900/40">{leave.leaveId}</p>
                    </TD>

                    {/* Period */}
                    <TD className="whitespace-nowrap text-sm text-ink-900/70">
                      {formatDate(leave.startDate)}
                      <span className="mx-1 text-ink-900/30">–</span>
                      {formatDate(leave.endDate)}
                    </TD>

                    {/* Days */}
                    <TD className="text-sm font-medium text-ink-900">
                      {leave.totalDays}
                    </TD>

                    {/* Status */}
                    <TD>
                      <LeaveStatusBadge status={leave.status} />
                    </TD>

                    {/* Applied */}
                    <TD className="whitespace-nowrap text-sm text-ink-900/55">
                      {formatDate(leave.appliedDate)}
                    </TD>

                    {/* Action */}
                    <TD className="text-right">
                      <Link
                        href={`/leave/${leave.id}`}
                        className="text-sm font-medium text-brand-700 hover:underline"
                      >
                        {t("actions.review")}
                      </Link>
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </div>

        <Pagination
          basePath="/leave"
          params={{ q, status, type: leaveType, employee: employeeId, sort }}
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={10}
        />
      </Card>
    </div>
  );
}

// ── Employee: my own leave requests ──────────────────────────────────────────

async function MyLeaveRequests({
  userId,
  params,
}: {
  userId: string;
  params: Record<string, string | string[] | undefined>;
}) {
  const t  = await getTranslations("leave");

  const employee = await prisma.employee.findUnique({ where: { userId } });
  const page = parsePageParam(params.page);

  const [{ items, total, totalPages }, balances] = await Promise.all([
    employee
      ? getMyLeaveRequests({ employeeId: employee.id, page })
      : Promise.resolve({ items: [], total: 0, totalPages: 1 }),
    employee
      ? getEmployeeLeaveBalances(employee.id)
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-5">
      {/* ── Page header ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink-900">{t("myTitle")}</h2>
          <p className="mt-1 text-sm text-ink-900/60">{t("myDescription")}</p>
        </div>
        {employee && (
          <ButtonLink href="/leave/new">
            <Plus className="h-4 w-4" />
            {t("newRequest")}
          </ButtonLink>
        )}
      </div>

      {/* ── Leave balance summary ─────────────────────────────────── */}
      {employee && balances.length > 0 && (
        <Card className="p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-900/40">
            {t("balanceTitle", { year: new Date().getFullYear() })}
          </p>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
            {balances.map((b) => (
              <div key={b.leaveType}>
                <p className="text-xs text-ink-900/50">{LEAVE_TYPE_LABELS[b.leaveType]}</p>
                <p className="mt-0.5 text-lg font-semibold text-ink-900">
                  {b.remaining === null ? "∞" : b.remaining}
                  {b.entitled !== null && (
                    <span className="text-sm font-normal text-ink-900/35"> / {b.entitled}</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Requests table ────────────────────────────────────────── */}
      <Card>
        {!employee ? (
          <EmptyState
            title={t("noLinkedEmployee")}
            description={t("noLinkedEmployeeDesc")}
            icon={<Users className="h-8 w-8" />}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TH>{t("columns.leaveType")}</TH>
                  <TH>{t("columns.period")}</TH>
                  <TH>{t("columns.days")}</TH>
                  <TH>{t("columns.status")}</TH>
                  <TH>{t("columns.applied")}</TH>
                  <TH className="text-right">{t("columns.details")}</TH>
                </THead>
                <TBody>
                  {items.length === 0 ? (
                    <EmptyRow colSpan={6}>
                      <div className="py-2 text-center">
                        <p className="font-medium text-ink-900/60">{t("noRequests")}</p>
                        <p className="mt-0.5 text-xs text-ink-900/40">
                          {t("noRequestsDesc")}
                        </p>
                      </div>
                    </EmptyRow>
                  ) : (
                    items.map((leave) => (
                      <TR key={leave.id}>
                        <TD>
                          <p className="font-medium text-ink-900/85">
                            {LEAVE_TYPE_LABELS[leave.leaveType]}
                          </p>
                          <p className="text-xs text-ink-900/40">{leave.leaveId}</p>
                        </TD>
                        <TD className="whitespace-nowrap text-sm text-ink-900/70">
                          {formatDate(leave.startDate)}
                          <span className="mx-1 text-ink-900/30">–</span>
                          {formatDate(leave.endDate)}
                        </TD>
                        <TD className="text-sm font-medium text-ink-900">
                          {leave.totalDays}
                        </TD>
                        <TD>
                          <LeaveStatusBadge status={leave.status} />
                        </TD>
                        <TD className="whitespace-nowrap text-sm text-ink-900/55">
                          {formatDate(leave.appliedDate)}
                        </TD>
                        <TD className="text-right">
                          <Link
                            href={`/leave/${leave.id}`}
                            className="text-sm font-medium text-brand-700 hover:underline"
                          >
                            {t("actions.view")}
                          </Link>
                        </TD>
                      </TR>
                    ))
                  )}
                </TBody>
              </Table>
            </div>

            <Pagination
              basePath="/leave"
              params={{}}
              page={page}
              totalPages={totalPages}
              totalItems={total}
              pageSize={10}
            />
          </>
        )}
      </Card>
    </div>
  );
}
