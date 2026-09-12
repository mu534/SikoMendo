import Link from "next/link";
import {
  UserPlus,
  LogOut,
  FileWarning,
  AlertTriangle,
  CheckCircle2,
  Archive,
  Activity,
} from "lucide-react";
import { requirePermission } from "@/lib/session";
import {
  getLifecycleSummaryCounts,
  getOnboardingEmployees,
  getRecentlyOnboardedEmployees,
  getEmployeesMissingDocuments,
  getContractsExpiringSoon,
  getOffboardingEmployees,
  getRecentlyArchivedEmployees,
} from "@/features/lifecycle/queries";
import {
  OFFBOARDING_REASON_LABELS,
  type OffboardingReasonValue,
} from "@/features/lifecycle/schemas";
import { formatDate } from "@/lib/utils";
import { Card, CardHeader, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";

export default async function LifecycleDashboardPage() {
  await requirePermission("VIEW_LIFECYCLE");

  const [
    counts,
    onboardingEmployees,
    recentlyOnboarded,
    missingDocs,
    expiringContracts,
    offboardingEmployees,
    recentlyArchived,
  ] = await Promise.all([
    getLifecycleSummaryCounts(),
    getOnboardingEmployees(),
    getRecentlyOnboardedEmployees(),
    getEmployeesMissingDocuments(),
    getContractsExpiringSoon(30),
    getOffboardingEmployees(),
    getRecentlyArchivedEmployees(),
  ]);

  // Pre-compute days-left outside JSX. Date.now() is safe in a server component
  // (called once per request, not on re-render) — suppress the client-oriented rule.
  const contractsWithDaysLeft = expiringContracts.map((c) => ({
    ...c,
    // eslint-disable-next-line react-hooks/purity
    daysLeft: c.endDate
      ? Math.ceil((c.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null,
  }));

  return (
    <div className="space-y-8">
      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-700/10 text-brand-700">
          <Activity className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold text-ink-900">
            Employee Lifecycle
          </h2>
          <p className="mt-0.5 text-sm text-ink-900/55">
            Actionable overview of onboarding, employment changes, and offboarding activity.
          </p>
        </div>
      </div>

      {/* ── Summary stat cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Currently onboarding"
          value={counts.onboarding}
          hint="Employees in ONBOARDING status"
          icon={<UserPlus className="h-5 w-5" />}
        />
        <StatCard
          label="Missing ID document"
          value={counts.missingDocs}
          hint="Onboarding employees without an ID document"
          icon={<FileWarning className="h-5 w-5" />}
        />
        <StatCard
          label="Contracts expiring"
          value={counts.expiring}
          hint="Active contracts expiring within 30 days"
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <StatCard
          label="Pending offboarding"
          value={counts.offboarding}
          hint="Employees with offboarding in progress"
          icon={<LogOut className="h-5 w-5" />}
        />
      </div>

      {/* ── Two-column sections ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Onboarding in progress */}
        <Card>
          <CardHeader
            title="Currently onboarding"
            description={`${onboardingEmployees.length} employee${onboardingEmployees.length === 1 ? "" : "s"} in progress`}
            action={
              <Link
                href="/employees?status=ONBOARDING"
                className="text-xs font-medium text-brand-700 hover:underline"
              >
                View all
              </Link>
            }
          />
          {onboardingEmployees.length === 0 ? (
            <EmptyState
              icon={<UserPlus className="h-7 w-7" />}
              title="No employees onboarding"
              description="New employees will appear here when created."
            />
          ) : (
            <ul className="divide-y divide-ink-900/6">
              {onboardingEmployees.slice(0, 6).map((emp) => (
                <li key={emp.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar
                    name={`${emp.firstName} ${emp.lastName}`}
                    imageUrl={emp.profileImageUrl ?? undefined}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/employees/${emp.id}?tab=lifecycle`}
                      className="truncate text-sm font-medium text-ink-900 hover:text-brand-700"
                    >
                      {emp.firstName} {emp.lastName}
                    </Link>
                    <p className="text-xs text-ink-900/45">
                      {emp.department?.name ?? "—"} · {emp.position?.name ?? "—"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-ink-900/45">
                      {emp.onboardingRecord?.startedAt
                        ? `Started ${formatDate(emp.onboardingRecord.startedAt)}`
                        : "—"}
                    </p>
                    {emp.onboardingRecord?.responsibleHr && (
                      <p className="text-xs text-ink-900/35">
                        {emp.onboardingRecord.responsibleHr.name}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Pending offboarding */}
        <Card>
          <CardHeader
            title="Pending offboarding"
            description={`${offboardingEmployees.length} employee${offboardingEmployees.length === 1 ? "" : "s"} in progress`}
          />
          {offboardingEmployees.length === 0 ? (
            <EmptyState
              icon={<LogOut className="h-7 w-7" />}
              title="No pending offboardings"
              description="Employees undergoing offboarding will appear here."
            />
          ) : (
            <ul className="divide-y divide-ink-900/6">
              {offboardingEmployees.slice(0, 6).map((emp) => (
                <li key={emp.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar
                    name={`${emp.firstName} ${emp.lastName}`}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/employees/${emp.id}?tab=lifecycle`}
                      className="truncate text-sm font-medium text-ink-900 hover:text-brand-700"
                    >
                      {emp.firstName} {emp.lastName}
                    </Link>
                    <p className="text-xs text-ink-900/45">
                      {emp.department?.name ?? "—"} ·{" "}
                      {emp.offboardingRecord
                        ? OFFBOARDING_REASON_LABELS[emp.offboardingRecord.reason as OffboardingReasonValue]
                        : "—"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge tone="warning">Offboarding</Badge>
                    {emp.offboardingRecord?.lastWorkingDate && (
                      <p className="mt-0.5 text-xs text-ink-900/45">
                        LWD: {formatDate(emp.offboardingRecord.lastWorkingDate)}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Contracts expiring soon */}
        <Card>
          <CardHeader
            title="Contracts expiring soon"
            description="Active contracts ending within the next 30 days"
          />
          {expiringContracts.length === 0 ? (
            <EmptyState
              icon={<AlertTriangle className="h-7 w-7" />}
              title="No contracts expiring soon"
            />
          ) : (
            <ul className="divide-y divide-ink-900/6">
              {contractsWithDaysLeft.map((contract) => {
                const { daysLeft } = contract;
                return (
                  <li key={contract.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/employees/${contract.employee.id}?tab=contracts`}
                        className="text-sm font-medium text-ink-900 hover:text-brand-700"
                      >
                        {contract.employee.firstName} {contract.employee.lastName}
                      </Link>
                      <p className="text-xs text-ink-900/45">
                        {contract.employee.department?.name ?? "—"} · {contract.contractType}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {daysLeft !== null && daysLeft <= 7 ? (
                        <Badge tone="danger">{daysLeft}d left</Badge>
                      ) : daysLeft !== null ? (
                        <Badge tone="warning">{daysLeft}d left</Badge>
                      ) : null}
                      {contract.endDate && (
                        <p className="mt-0.5 text-xs text-ink-900/45">
                          Ends {formatDate(contract.endDate)}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Missing documents */}
        <Card>
          <CardHeader
            title="Missing ID documents"
            description="Onboarding employees without a required ID document"
          />
          {missingDocs.length === 0 ? (
            <EmptyState
              icon={<FileWarning className="h-7 w-7" />}
              title="All onboarding employees have ID documents"
            />
          ) : (
            <ul className="divide-y divide-ink-900/6">
              {missingDocs.map((emp) => (
                <li key={emp.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/employees/${emp.id}?tab=documents`}
                      className="text-sm font-medium text-ink-900 hover:text-brand-700"
                    >
                      {emp.firstName} {emp.lastName}
                    </Link>
                    <p className="text-xs text-ink-900/45">
                      {emp.department?.name ?? "—"}
                    </p>
                  </div>
                  <Badge tone="warning">ID missing</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ── Recently onboarded / recently archived ────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Recently onboarded */}
        <Card>
          <CardHeader
            title="Recently onboarded"
            description="Employees who completed onboarding in the last 30 days"
          />
          {recentlyOnboarded.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-7 w-7" />}
              title="No recent onboardings"
            />
          ) : (
            <ul className="divide-y divide-ink-900/6">
              {recentlyOnboarded.map((emp) => (
                <li key={emp.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar
                    name={`${emp.firstName} ${emp.lastName}`}
                    imageUrl={emp.profileImageUrl ?? undefined}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/employees/${emp.id}`}
                      className="text-sm font-medium text-ink-900 hover:text-brand-700"
                    >
                      {emp.firstName} {emp.lastName}
                    </Link>
                    <p className="text-xs text-ink-900/45">
                      {emp.department?.name ?? "—"} · {emp.position?.name ?? "—"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge tone="success">Active</Badge>
                    {emp.onboardingRecord?.completedAt && (
                      <p className="mt-0.5 text-xs text-ink-900/45">
                        {formatDate(emp.onboardingRecord.completedAt)}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Recently archived */}
        <Card>
          <CardHeader
            title="Recently archived"
            description="Employees archived in the last 60 days"
          />
          {recentlyArchived.length === 0 ? (
            <EmptyState
              icon={<Archive className="h-7 w-7" />}
              title="No recently archived employees"
            />
          ) : (
            <ul className="divide-y divide-ink-900/6">
              {recentlyArchived.map((emp) => (
                <li key={emp.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/employees/${emp.id}?tab=lifecycle`}
                      className="text-sm font-medium text-ink-900/60 hover:text-ink-900"
                    >
                      {emp.firstName} {emp.lastName}
                    </Link>
                    <p className="text-xs text-ink-900/45">
                      {emp.department?.name ?? "—"} ·{" "}
                      {emp.offboardingRecord
                        ? OFFBOARDING_REASON_LABELS[emp.offboardingRecord.reason as OffboardingReasonValue]
                        : emp.employmentStatus}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge tone="neutral">Archived</Badge>
                    {emp.deletedAt && (
                      <p className="mt-0.5 text-xs text-ink-900/45">
                        {formatDate(emp.deletedAt)}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
