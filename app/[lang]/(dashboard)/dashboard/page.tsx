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
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import {
  getOrganizationStats,
  getRecentAuditLogs,
  getOwnAttendanceSummary,
  getAttendanceTrend,
  getLeaveStatusBreakdown,
  getEmployeesByDepartment,
  getNeedsAttention,
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

type TFunction = Awaited<ReturnType<typeof getTranslations>>;

/** Converts a raw audit action + entity into a short readable sentence. */
function auditSentence(t: TFunction, action: string, entity: string): string {
  const a = action.toUpperCase();
  const e = entity.toLowerCase().replace(/_/g, " ");

  const knownActions = [
    "CREATE", "UPDATE", "UPDATE_PROFILE", "UPDATE_OWN_INFO",
    "ARCHIVE", "RESTORE", "DELETE", "SUSPEND", "REACTIVATE",
    "PASSWORD_RESET", "FORCE_PASSWORD_CHANGE", "PASSWORD_CHANGED",
    "APPROVE", "REJECT", "CANCEL", "UPSERT", "BULK_MARK_PRESENT",
    "TERMINATE", "ACTIVATE", "DEACTIVATE",
  ];

  if (knownActions.includes(a)) {
    return t(`audit.${a}` as Parameters<TFunction>[0], { entity: e });
  }

  return t("audit.unknown", { action: action.toLowerCase(), entity: e });
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
  const [stats, logs, attendanceTrend, leaveBreakdown, departmentHeadcount, needsAttention] = await Promise.all([
    getOrganizationStats(),
    getRecentAuditLogs(8),
    getAttendanceTrend(30),
    getLeaveStatusBreakdown(),
    getEmployeesByDepartment(),
    getNeedsAttention(),
  ]);

  const t = await getTranslations("dashboard");
  const tC = await getTranslations("common");

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
          {t("welcomeBack", { name: userName.split(" ")[0] })}
        </h2>
        <p className="mt-1 text-sm text-ink-900/60">
          {t("orgSubtitle")}
        </p>
      </div>

      {/* ── KPI stat row ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Link href="/employees" className="group">
          <StatCard
            label={t("stats.totalEmployees")}
            value={stats.totalEmployees}
            hint={t("stats.activeEmployees", { count: stats.activeEmployees })}
            icon={<Users className="h-5 w-5" />}
          />
        </Link>
        <Link href="/cooperatives" className="group">
          <StatCard
            label={t("stats.cooperatives")}
            value={stats.totalCooperatives}
            icon={<Building2 className="h-5 w-5" />}
          />
        </Link>
        <Link href="/attendance" className="group">
          <StatCard
            label={t("stats.presentToday")}
            value={stats.presentToday}
            hint={t("stats.attendanceRate", { rate: attendanceRate })}
            icon={<CalendarCheck className="h-5 w-5" />}
          />
        </Link>
        <Link href="/leave" className="group">
          <StatCard
            label={t("stats.absentToday")}
            value={stats.absentToday}
            icon={<CalendarX className="h-5 w-5" />}
          />
        </Link>
      </div>

      {/* ── Needs Attention ───────────────────────────────────── */}
      {(needsAttention.pendingLeave > 0 ||
        needsAttention.onboarding > 0 ||
        needsAttention.offboarding > 0 ||
        needsAttention.expiringContracts > 0 ||
        needsAttention.missingDocuments > 0) && (
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Bell className="h-4 w-4 text-gold-600" />
            <h3 className="text-sm font-semibold text-ink-900">{t("needsAttention.title")}</h3>
          </div>
          <div className="flex flex-wrap gap-3">
            {needsAttention.pendingLeave > 0 && (
              <Link
                href="/leave?status=PENDING"
                className="inline-flex items-center gap-2 rounded-lg border border-gold-400/30 bg-gold-400/10 px-3 py-2 text-sm font-medium text-ink-900 hover:bg-gold-400/20 transition-colors"
              >
                <CalendarOff className="h-3.5 w-3.5 text-gold-600" />
                {t("needsAttention.pendingLeave", { count: needsAttention.pendingLeave })}
              </Link>
            )}
            {needsAttention.onboarding > 0 && (
              <Link
                href="/employees/lifecycle"
                className="inline-flex items-center gap-2 rounded-lg border border-brand-400/30 bg-brand-400/10 px-3 py-2 text-sm font-medium text-ink-900 hover:bg-brand-400/20 transition-colors"
              >
                <UserCheck className="h-3.5 w-3.5 text-brand-600" />
                {t("needsAttention.onboarding", { count: needsAttention.onboarding })}
              </Link>
            )}
            {needsAttention.offboarding > 0 && (
              <Link
                href="/employees/lifecycle"
                className="inline-flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm font-medium text-ink-900 hover:bg-red-400/20 transition-colors"
              >
                <ArrowRight className="h-3.5 w-3.5 text-red-600" />
                {t("needsAttention.offboarding", { count: needsAttention.offboarding })}
              </Link>
            )}
            {needsAttention.expiringContracts > 0 && (
              <Link
                href="/employees"
                className="inline-flex items-center gap-2 rounded-lg border border-orange-400/30 bg-orange-400/10 px-3 py-2 text-sm font-medium text-ink-900 hover:bg-orange-400/20 transition-colors"
              >
                <FileBarChart className="h-3.5 w-3.5 text-orange-600" />
                {t("needsAttention.expiringContracts", { count: needsAttention.expiringContracts })}
              </Link>
            )}
            {needsAttention.missingDocuments > 0 && (
              <span className="inline-flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm font-medium text-ink-900">
                <FileBarChart className="h-3.5 w-3.5 text-red-600" />
                {t("needsAttention.missingDocuments", { count: needsAttention.missingDocuments })}
              </span>
            )}
          </div>
        </Card>
      )}

      {/* ── Charts ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title={t("charts.attendanceTrend")}
              description={t("charts.attendanceTrendDesc")}
            />
            <div className="p-6 pt-4">
              <AttendanceTrendChart data={attendanceTrend} />
            </div>
          </Card>
        </div>
        <Card>
          <CardHeader
            title={t("charts.leaveRequests")}
            description={t("charts.leaveRequestsDesc")}
          />
          <div className="p-6 pt-4">
            <LeaveStatusChart data={leaveBreakdown} />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={t("charts.headcountByDept")}
          description={t("charts.headcountByDeptDesc")}
        />
        <div className="p-6 pt-4">
          <DepartmentHeadcountChart data={departmentHeadcount} />
        </div>
      </Card>

      {/* ── Recent activity ─────────────────────────────────────── */}
      <Card>
        <CardHeader
          title={t("recentActivity.title")}
          description={t("recentActivity.description")}
          action={
            <Link
              href="/audit-log"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
            >
              {tC("viewAll")} <ArrowRight className="h-3 w-3" />
            </Link>
          }
        />
        {logs.length === 0 ? (
          <EmptyState
            title={t("recentActivity.empty")}
            description={t("recentActivity.emptyDesc")}
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
                    {log.user?.name ?? t("audit.system")}
                  </span>{" "}
                  {auditSentence(t, log.action, log.entity)}
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

  const t = await getTranslations("dashboard");
  const tC = await getTranslations("common");
  const tN = await getTranslations("notifications");

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">
          {t("welcomeBack", { name: userName.split(" ")[0] })}
        </h2>
        <p className="mt-1 text-sm text-ink-900/60">
          {t("empSubtitle")}
        </p>
      </div>

      {!employee ? (
        <Card>
          <EmptyState
            title={t("noEmployeeRecord.title")}
            description={t("noEmployeeRecord.description")}
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
                  {employee.position?.name ?? tC("noPosition")} · {employee.department?.name ?? tC("noDepartment")}
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
                {t("quickLinks.newLeaveRequest")}
              </ButtonLink>
              <ButtonLink href="/attendance" variant="outline" size="sm">
                {t("quickLinks.myAttendance")}
              </ButtonLink>
              <ButtonLink href="/my-documents" variant="outline" size="sm">
                {t("quickLinks.myDocuments")}
              </ButtonLink>
              <ButtonLink href="/profile" variant="ghost" size="sm">
                {t("quickLinks.myProfile")}
              </ButtonLink>
            </div>
          </Card>

          {/* ── Attendance stats ──────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label={t("stats.presentMonth")}
              value={attendance?.present ?? 0}
              icon={<UserCheck className="h-5 w-5" />}
            />
            <StatCard
              label={t("stats.absentMonth")}
              value={attendance?.absent ?? 0}
              icon={<CalendarX className="h-5 w-5" />}
            />
            <StatCard
              label={t("stats.lateMonth")}
              value={attendance?.late ?? 0}
              icon={<CalendarCheck className="h-5 w-5" />}
            />
            <StatCard
              label={t("stats.pendingLeave")}
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
                  title={t("leaveBalance.title")}
                  description={t("leaveBalance.description", { year: new Date().getFullYear() })}
                />
                <div className="p-5 pt-3">
                  {(balances ?? []).length === 0 ? (
                    <p className="text-sm text-ink-900/50">{t("leaveBalance.noEntitlements")}</p>
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
              <CardHeader title={tN("title")} />
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
