import Link from "next/link";
import { CalendarOff, Plus, Users } from "lucide-react";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { listAllLeaveRequests, getMyLeaveRequests, listEmployeesForLeaveFilter } from "@/features/leave/queries";
import { LeaveStatusBadge } from "@/features/leave/leave-status-badge";
import { LEAVE_TYPE_LABELS, LEAVE_TYPES, LEAVE_STATUSES, LEAVE_STATUS_LABELS } from "@/features/leave/schemas";
import { parsePageParam, parseStringParam, formatDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Select } from "@/components/ui/field";
import { Toolbar } from "@/components/ui/toolbar";
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
    return <AllLeaveRequests params={params} />;
  }

  return <MyLeaveRequests userId={session.user.id} params={params} />;
}

// ── Manager / Admin: all leave requests ─────────────────────────────────────

async function AllLeaveRequests({ params }: { params: Record<string, string | string[] | undefined> }) {
  const q = parseStringParam(params.q);
  const status = parseStringParam(params.status);
  const leaveType = parseStringParam(params.type);
  const employeeId = parseStringParam(params.employee);
  const page = parsePageParam(params.page);

  const [{ items, total, totalPages }, employees] = await Promise.all([
    listAllLeaveRequests({ q, status, leaveType, employeeId, page }),
    listEmployeesForLeaveFilter(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">Leave requests</h2>
        <p className="mt-1 text-sm text-ink-900/60">Review, approve, or reject leave requests across the union.</p>
      </div>

      <Card>
        <Toolbar basePath="/leave" searchPlaceholder="Search by employee, leave ID, or reason" searchDefault={q}>
          <Select name="employee" defaultValue={employeeId} className="w-48">
            <option value="">All employees</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.firstName} {e.lastName}
              </option>
            ))}
          </Select>
          <Select name="type" defaultValue={leaveType} className="w-44">
            <option value="">All leave types</option>
            {LEAVE_TYPES.map((t) => (
              <option key={t} value={t}>
                {LEAVE_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
          <Select name="status" defaultValue={status} className="w-40">
            <option value="">All statuses</option>
            {LEAVE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LEAVE_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </Toolbar>

        <Table>
          <THead>
            <TH>Employee</TH>
            <TH>Leave</TH>
            <TH>Dates</TH>
            <TH>Days</TH>
            <TH>Status</TH>
            <TH>Applied</TH>
          </THead>
          <TBody>
            {items.length === 0 && (
              <EmptyRow colSpan={6}>
                <CalendarOff className="mx-auto mb-2 h-8 w-8 text-ink-900/20" />
                No leave requests match your filters.
              </EmptyRow>
            )}
            {items.map((leave) => (
              <TR key={leave.id}>
                <TD>
                  <Link href={`/leave/${leave.id}`} className="flex items-center gap-3">
                    <Avatar
                      name={`${leave.employee.firstName} ${leave.employee.lastName}`}
                      imageUrl={leave.employee.profileImageUrl}
                      size="sm"
                    />
                    <div>
                      <p className="font-medium text-ink-900">
                        {leave.employee.firstName} {leave.employee.lastName}
                      </p>
                      <p className="text-xs text-ink-900/50">{leave.employee.employeeId}</p>
                    </div>
                  </Link>
                </TD>
                <TD>
                  <p className="text-ink-900/80">{LEAVE_TYPE_LABELS[leave.leaveType]}</p>
                  <p className="text-xs text-ink-900/50">{leave.leaveId}</p>
                </TD>
                <TD>
                  {formatDate(leave.startDate)} – {formatDate(leave.endDate)}
                </TD>
                <TD>{leave.totalDays}</TD>
                <TD>
                  <LeaveStatusBadge status={leave.status} />
                </TD>
                <TD>{formatDate(leave.appliedDate)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>

        <Pagination
          basePath="/leave"
          params={{ q, status, type: leaveType, employee: employeeId }}
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={10}
        />
      </Card>
    </div>
  );
}

// ── Employee: my own leave requests ─────────────────────────────────────────

async function MyLeaveRequests({
  userId,
  params,
}: {
  userId: string;
  params: Record<string, string | string[] | undefined>;
}) {
  const employee = await prisma.employee.findUnique({ where: { userId } });
  const page = parsePageParam(params.page);

  const { items, total, totalPages } = employee
    ? await getMyLeaveRequests({ employeeId: employee.id, page })
    : { items: [], total: 0, totalPages: 1 };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink-900">My leave requests</h2>
          <p className="mt-1 text-sm text-ink-900/60">Submit and track your leave requests.</p>
        </div>
        {employee && (
          <ButtonLink href="/leave/new">
            <Plus className="h-4 w-4" />
            New Request
          </ButtonLink>
        )}
      </div>

      <Card>
        {!employee ? (
          <EmptyState
            title="No employee record linked yet"
            description="Ask your HR Officer to link your account to your employee record before requesting leave."
            icon={<Users className="h-8 w-8" />}
          />
        ) : (
          <>
            <Table>
              <THead>
                <TH>Leave</TH>
                <TH>Dates</TH>
                <TH>Days</TH>
                <TH>Status</TH>
                <TH>Applied</TH>
                <TH className="text-right">Details</TH>
              </THead>
              <TBody>
                {items.length === 0 && (
                  <EmptyRow colSpan={6}>
                    <CalendarOff className="mx-auto mb-2 h-8 w-8 text-ink-900/20" />
                    You haven&apos;t submitted any leave requests yet.
                  </EmptyRow>
                )}
                {items.map((leave) => (
                  <TR key={leave.id}>
                    <TD>
                      <p className="font-medium text-ink-900">{LEAVE_TYPE_LABELS[leave.leaveType]}</p>
                      <p className="text-xs text-ink-900/50">{leave.leaveId}</p>
                    </TD>
                    <TD>
                      {formatDate(leave.startDate)} – {formatDate(leave.endDate)}
                    </TD>
                    <TD>{leave.totalDays}</TD>
                    <TD>
                      <LeaveStatusBadge status={leave.status} />
                    </TD>
                    <TD>{formatDate(leave.appliedDate)}</TD>
                    <TD className="text-right">
                      <Link href={`/leave/${leave.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                        View
                      </Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>

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
