import { Users, Building2, CalendarCheck, CalendarX, FileBarChart, UserCheck } from "lucide-react";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getOrganizationStats, getRecentAuditLogs, getOwnAttendanceSummary } from "@/features/Dashboard/queries";
import prisma from "@/lib/prisma";
import { StatCard, Card, CardHeader } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import type { AuditLog } from "@prisma/client";


export default async function DashboardPage() {
  const session = await requireSession();

  if (can(session.user.role, "DASHBOARD_ANALYTICS")) {
    return <OrganizationDashboard userName={session.user.name} />;
  }

  return <EmployeeDashboard userId={session.user.id} userName={session.user.name} />;
}

async function OrganizationDashboard({ userName }: { userName: string }) {
  const [stats, logs] = await Promise.all([getOrganizationStats(), getRecentAuditLogs()]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">Welcome back, {userName.split(" ")[0]}</h2>
        <p className="mt-1 text-sm text-ink-900/60">Here is what is happening across Siko Mendo Union today.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total employees" value={stats.totalEmployees} hint={`${stats.activeEmployees} active`} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Cooperatives" value={stats.totalCooperatives} icon={<Building2 className="h-5 w-5" />} />
        <StatCard label="Present today" value={stats.presentToday} icon={<CalendarCheck className="h-5 w-5" />} />
        <StatCard label="Absent today" value={stats.absentToday} icon={<CalendarX className="h-5 w-5" />} />
      </div>

      <Card>
        <CardHeader title="Recent activity" description="The latest changes recorded across the system." />
        {logs.length === 0 ? (
          <EmptyState title="No activity yet" description="Actions like creating employees or users will show up here." icon={<FileBarChart className="h-8 w-8" />} />
        ) : (
          <ul className="divide-y divide-ink-900/6">
            {logs.map((log: AuditLog & { user: { name: string } | null }) => (
              <li key={log.id} className="flex items-center justify-between gap-3 px-6 py-3.5 text-sm">
                <span className="text-ink-900/80">
                  <span className="font-medium text-ink-900">{log.user?.name ?? "System"}</span>{" "}
                  {log.action.toLowerCase()}d a {log.entity.toLowerCase()} record
                </span>
                <span className="shrink-0 text-xs text-ink-900/45">{formatDateTime(log.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

async function EmployeeDashboard({ userId, userName }: { userId: string; userName: string }) {
  const employee = await prisma.employee.findUnique({ where: { userId } });
  const attendance = employee ? await getOwnAttendanceSummary(employee.id) : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">Welcome back, {userName.split(" ")[0]}</h2>
        <p className="mt-1 text-sm text-ink-900/60">A quick look at your attendance this month.</p>
      </div>

      {attendance ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Present" value={attendance.present} icon={<UserCheck className="h-5 w-5" />} />
          <StatCard label="Absent" value={attendance.absent} icon={<CalendarX className="h-5 w-5" />} />
          <StatCard label="Late" value={attendance.late} icon={<CalendarCheck className="h-5 w-5" />} />
        </div>
      ) : (
        <Card>
          <EmptyState
            title="No employee record linked yet"
            description="Ask your HR Officer to link your account to your employee record to see attendance here."
            icon={<Users className="h-8 w-8" />}
          />
        </Card>
      )}
    </div>
  );
}
