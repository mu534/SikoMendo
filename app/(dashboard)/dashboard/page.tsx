import {
  Users,
  Building2,
  CalendarCheck,
  CalendarX,
  FileBarChart,
  UserCheck,
  CalendarOff,
  Plus,
  Bell,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import {
  getOrganizationStats,
  getRecentAuditLogs,
  getOwnAttendanceSummary,
  getAttendanceTrend,
  getLeaveStatusBreakdown,
  getEmployeesByDepartment,
} from "@/features/Dashboard/queries";
import { getEmployeeLeaveBalances } from "@/features/leave/queries";
import { getRecentNotifications } from "@/features/notifications/queries";
import { AttendanceTrendChart } from "@/features/Dashboard/attendance-trend-chart";
import { LeaveStatusChart } from "@/features/Dashboard/leave-status-chart";
import { DepartmentHeadcountChart } from "@/features/Dashboard/department-headcount-chart";
import prisma from "@/lib/prisma";
import { StatCard, Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { LEAVE_TYPE_LABELS } from "@/features/leave/schemas";
import { formatDateTime } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import type { AuditLog } from "@prisma/client";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Converts a raw audit action + entity into a short readable sentence. */
function auditSentence(action: string, entity: string): string {
  const a = action.toUpperCase();
  const e = entity.toLowerCase().replace(/_/g, " ");

  const map: Record<string, string> = {
    CREATE:               `created a ${e}`,
    UPDATE:               `updated a ${e}`,
    UPDATE_PROFILE:       "updated their profile",
    UPDATE_OWN_INFO:      "updated their contact info",
    ARCHIVE:              `archived a ${e}`,
    RESTORE:              `restored a ${e}`,
    DELETE:               `deleted a ${e}`,
    SUSPEND:              "suspended a user account",
    REACTIVATE:           "reactivated a user account",
    PASSWORD_RESET:       "reset a user password",
    FORCE_PASSWORD_CHANGE:"forced a password change",
    PASSWORD_CHANGED:     "changed their password",
    APPROVE:              "approved a leave request",
    REJECT:               "rejected a leave request",
    CANCEL:               "cancelled a leave request",
    UPSERT:               `recorded ${e}`,
    BULK_MARK_PRESENT:    "bulk-marked employees present",
    TERMINATE:            `terminated a ${e}`,
    ACTIVATE:             `activated a ${e}`,
    DEACTIVATE:           `deactivated a ${e}`,
  };

  return map[a] ?? `performed "${action.toLowerCase()}" on a ${e}`;
}

// ── Dashboard router ──────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await requireSession();

  if (can(session.user.role, "DASHBOARD_ANALYTICS")) {
    return <OrganizationDashboard userName={session.user.name} />;
  }

  return <EmployeeDashboard userId={session.user.id} userName={session.user.name} />;
}

// ── Organisation dashboard (Admin / HR / Manager) ─────────────────────────────

async function OrganizationDashboard({ userName }: { userName: string }) {
  const [stats, logs, attendanceTrend, leaveBreakdown, departmentHeadcount] = await Promise.all([
    getOrganizationStats(),
    getRecentAuditLogs(8),
    getAttendanceTrend(30),
    getLeaveStatusBreakdown(),
    getEmployeesByDepartment(),
  ]);

  // Attendance rate for today (avoid divide-by-zero)
  const totalMarkedToday = stats.presentToday + stats.absentToday;
  const attendanceRate =
    totalMarkedToday > 0
      ? `${Math.round((stats.presentToday / totalMarkedToday) * 100)}%`
      : "—";

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">
          Welcome back, {userName.split(" ")[0]}
        </h2>
        <p className="mt-1 text-sm text-ink-900/60">
          Here is what is happening across Siko Mendo Union today.
        </p>
      </div>

      {/* ── KPI stat row ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Link href="/employees" className="group">
          <StatCard
            label="Total employees"
            value={stats.totalEmployees}
            hint={`${stats.activeEmployees} active`}
            icon={<Users className="h-5 w-5" />}
          />
        </Link>
        <Link href="/cooperatives" className="group">
          <StatCard
            label="Cooperatives"
            value={stats.totalCooperatives}
            icon={<Building2 className="h-5 w-5" />}
          />
        </Link>
        <Link href="/attendance" className="group">
          <StatCard
            label="Present today"
            value={stats.presentToday}
            hint={`${attendanceRate} attendance rate`}
            icon={<CalendarCheck className="h-5 w-5" />}
          />
        </Link>
        <Link href="/leave" className="group">
          <StatCard
            label="Absent today"
            value={stats.absentToday}
            icon={<CalendarX className="h-5 w-5" />}
          />
        </Link>
      </div>

      {/* ── Charts ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Attendance trend"
              description="Present vs. absent over the last 30 days."
            />
            <div className="p-6 pt-4">
              <AttendanceTrendChart data={attendanceTrend} />
            </div>
          </Card>
        </div>
        <Card>
          <CardHeader
            title="Leave requests"
            description="Breakdown by current status."
          />
          <div className="p-6 pt-4">
            <LeaveStatusChart data={leaveBreakdown} />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Headcount by department"
          description="Active employees, grouped by department."
        />
        <div className="p-6 pt-4">
          <DepartmentHeadcountChart data={departmentHeadcount} />
        </div>
      </Card>

      {/* ── Recent activity ─────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Recent activity"
          description="The latest changes recorded across the system."
          action={
            <Link
              href="/audit-log"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          }
        />
        {logs.length === 0 ? (
          <EmptyState
            title="No activity yet"
            description="Actions like creating employees or users will show up here."
            icon={<FileBarChart className="h-8 w-8" />}
          />
        ) : (
          <ul className="divide-y divide-ink-900/6">
            {logs.map((log: AuditLog & { user: { name: string } | null }) => (
              <li
                key={log.id}
                className="flex items-center justify-between gap-3 px-6 py-3 text-sm"
              >
                <span className="min-w-0 truncate text-ink-900/75">
                  <span className="font-medium text-ink-900">
                    {log.user?.name ?? "System"}
                  </span>{" "}
                  {auditSentence(log.action, log.entity)}
                </span>
                <span className="shrink-0 text-xs text-ink-900/40">
                  {formatDateTime(log.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ── Employee dashboard ─────────────────────────────────────────────────────────

async function EmployeeDashboard({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const employee = await prisma.employee.findUnique({
    where: { userId },
    include: {
      department: { select: { name: true } },
      position:   { select: { name: true } },
    },
  });

  const [attendance, balances, pendingCount, notifications] = await Promise.all([
    employee ? getOwnAttendanceSummary(employee.id)          : null,
    employee ? getEmployeeLeaveBalances(employee.id)          : null,
    employee
      ? prisma.leaveRequest.count({ where: { employeeId: employee.id, status: "PENDING" } })
      : 0,
    getRecentNotifications(userId, 5),
  ]);

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">
          Welcome back, {userName.split(" ")[0]}
        </h2>
        <p className="mt-1 text-sm text-ink-900/60">
          Here&apos;s a quick look at your workspace.
        </p>
      </div>

      {!employee ? (
        <Card>
          <EmptyState
            title="No employee record linked yet"
            description="Ask your HR Officer to link your account to your employee record to unlock the rest of your dashboard."
            icon={<Users className="h-8 w-8" />}
          />
        </Card>
      ) : (
        <>
          {/* ── Profile + quick links ─────────────────────────── */}
          <Card className="p-5">
            <div className="flex flex-wrap items-center gap-4">
              <Avatar name={userName} imageUrl={employee.profileImageUrl} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="font-display text-base font-semibold text-ink-900">
                  {userName}
                </p>
                <p className="text-sm text-ink-900/60">
                  {employee.position.name} · {employee.department.name}
                </p>
              </div>
              <Badge
                tone={employee.employmentStatus === "ACTIVE" ? "success" : "neutral"}
              >
                {employee.employmentStatus.replace("_", " ")}
              </Badge>
            </div>

            {/* Quick links — responsive pill row */}
            <div className="mt-4 flex flex-wrap gap-2 border-t border-ink-900/8 pt-4">
              <ButtonLink href="/leave/new" size="sm">
                <Plus className="h-3.5 w-3.5" />
                New Leave Request
              </ButtonLink>
              <ButtonLink href="/attendance" variant="outline" size="sm">
                My Attendance
              </ButtonLink>
              <ButtonLink href="/my-documents" variant="outline" size="sm">
                My Documents
              </ButtonLink>
              <ButtonLink href="/profile" variant="ghost" size="sm">
                My Profile
              </ButtonLink>
            </div>
          </Card>

          {/* ── Attendance stats ──────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="Present (month)"
              value={attendance?.present ?? 0}
              icon={<UserCheck className="h-5 w-5" />}
            />
            <StatCard
              label="Absent (month)"
              value={attendance?.absent ?? 0}
              icon={<CalendarX className="h-5 w-5" />}
            />
            <StatCard
              label="Late (month)"
              value={attendance?.late ?? 0}
              icon={<CalendarCheck className="h-5 w-5" />}
            />
            <StatCard
              label="Pending leave"
              value={pendingCount}
              icon={<CalendarOff className="h-5 w-5" />}
            />
          </div>

          {/* ── Leave balance + notifications ─────────────────── */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Leave balance — 2/3 width */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader
                  title="Leave balance"
                  description={`${new Date().getFullYear()} — remaining / entitled days per leave type.`}
                />
                <div className="p-5 pt-3">
                  {(balances ?? []).length === 0 ? (
                    <p className="text-sm text-ink-900/50">No entitlements configured.</p>
                  ) : (
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                      {(balances ?? []).map((b) => (
                        <div key={b.leaveType}>
                          <dt className="text-xs font-medium uppercase tracking-wide text-ink-900/45">
                            {LEAVE_TYPE_LABELS[b.leaveType]}
                          </dt>
                          <dd className="mt-0.5 text-xl font-semibold text-ink-900">
                            {b.remaining === null ? "∞" : b.remaining}
                            {b.entitled !== null && (
                              <span className="text-sm font-normal text-ink-900/40">
                                {" "}/ {b.entitled}
                              </span>
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </Card>
            </div>

            {/* Notifications — 1/3 width */}
            <Card>
              <CardHeader title="Notifications" />
              {notifications.items.length === 0 ? (
                <EmptyState
                  title="Nothing yet"
                  icon={<Bell className="h-8 w-8" />}
                />
              ) : (
                <ul className="divide-y divide-ink-900/6">
                  {notifications.items.map((n) => (
                    <li
                      key={n.id}
                      className={`px-5 py-3 ${n.isRead ? "" : "bg-brand-50/50"}`}
                    >
                      <p className="text-sm font-medium text-ink-900">{n.title}</p>
                      <p className="mt-0.5 text-xs text-ink-900/60">{n.message}</p>
                      <p className="mt-1 text-[11px] text-ink-900/35">
                        {formatDateTime(n.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
