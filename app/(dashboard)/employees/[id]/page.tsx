import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowLeft,
  Pencil,
  History,
  MoreHorizontal,
  Calendar,
  Clock,
  UserCircle2,
} from "lucide-react";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getEmployeeByIdForViewer, getEmployeeDetailTabPermissions } from "@/lib/employee-access";
import { listAssignableManagers } from "@/features/employees/queries";
import { updateEmployee, deleteEmployeeDocument } from "@/features/employees/actions";
import { ProfileTabs } from "@/features/employees/profile-tabs";
import { SystemAccountPanel } from "@/features/employees/system-account-panel";
import { OverviewPanel } from "@/features/employees/overview-panel";
import { EmploymentPanel } from "@/features/employees/employment-panel";
import { AttendancePanel } from "@/features/employees/attendance-panel";
import { LeavePanel } from "@/features/employees/leave-panel";
import { DocumentsPanel } from "@/features/employees/documents-panel";
import { LifecyclePanel } from "@/features/employees/lifecycle-panel";
import {
  getEmployeeLifecycleRecord,
  getOnboardingChecklist,
  getOffboardingChecklist,
} from "@/features/lifecycle/queries";
import { cancelOffboarding } from "@/features/lifecycle/actions";
import { listActiveDepartments } from "@/features/departments/queries";
import { listActivePositions } from "@/features/positions/queries";
import { getEmployeeMonthlyAttendance } from "@/features/attendance/queries";
import {
  getEmployeeLeaveBalances,
  getRecentEmployeeLeaveRequests,
} from "@/features/leave/queries";
import { formatDate } from "@/lib/utils";
import { Card, CardHeader as CardHeaderImport } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { ContractsPanel as ContractsPanelImport } from "@/features/contracts/contracts-panel";
import type { Document } from "@prisma/client";
import type { OffboardingReasonValue } from "@/features/lifecycle/schemas";
import type { ProfileTab } from "@/features/employees/profile-tabs";

// ── Status helpers ────────────────────────────────────────────────────────────

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
  PERMANENT:  "Permanent",
  CONTRACT:   "Contract",
  TEMPORARY:  "Temporary",
  PROBATION:  "Probation",
  INTERNSHIP: "Internship",
};

function yearsOfService(hireDate: Date | null): string | null {
  if (!hireDate) return null;
  const now = new Date();
  let years = now.getFullYear() - hireDate.getFullYear();
  const hasHadAnniversary =
    now.getMonth() > hireDate.getMonth() ||
    (now.getMonth() === hireDate.getMonth() && now.getDate() >= hireDate.getDate());
  if (!hasHadAnniversary) years -= 1;
  if (years < 1) {
    const months = Math.floor(
      (now.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
    );
    return months < 1 ? "Less than a month" : `${months} month${months === 1 ? "" : "s"}`;
  }
  return `${years} year${years === 1 ? "" : "s"}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("VIEW_EMPLOYEES");
  const { id } = await params;
  const sp = await searchParams;
  const rawTab = typeof sp.tab === "string" ? sp.tab : "overview";

  // P0-1: Scoped query — Manager can only access their own subordinates
  const employee = await getEmployeeByIdForViewer(id, session);
  if (!employee) notFound();

  // P0-2: Determine tab permissions per role
  const tabPerms = getEmployeeDetailTabPermissions(session.user.role);

  const canManage           = can(session.user.role, "MANAGE_EMPLOYEES");
  const canManageDocuments  = can(session.user.role, "MANAGE_DOCUMENTS") && tabPerms.canViewDocuments;
  const canManageHistory    = can(session.user.role, "MANAGE_EMPLOYMENT_HISTORY");
  const canManageContracts  = can(session.user.role, "MANAGE_CONTRACTS") && tabPerms.canViewContracts;
  const canManageUsers      = can(session.user.role, "MANAGE_USERS") && tabPerms.canViewSystemAccount;
  const canChangeRole       = can(session.user.role, "MANAGE_ROLES");
  const canViewLifecycle    = can(session.user.role, "VIEW_LIFECYCLE") && tabPerms.canViewLifecycle;
  const canManageOnboarding  = can(session.user.role, "MANAGE_ONBOARDING");
  const canManageOffboarding = can(session.user.role, "MANAGE_OFFBOARDING");
  const canViewAttendance   = can(session.user.role, "VIEW_ATTENDANCE");
  const canViewLeave        = can(session.user.role, "VIEW_ALL_LEAVE") || can(session.user.role, "MANAGE_LEAVE");

  // Build visible tabs for this role
  const visibleTabs: ProfileTab[] = ["overview", "employment"];
  if (canViewAttendance) visibleTabs.push("attendance");
  if (canViewLeave) visibleTabs.push("leave");
  if (tabPerms.canViewDocuments) visibleTabs.push("documents");
  if (canViewLifecycle) visibleTabs.push("lifecycle");

  // Redirect sensitive tabs to overview
  const tab: ProfileTab =
    visibleTabs.includes(rawTab as ProfileTab) ? (rawTab as ProfileTab) : "overview";

  // ── Data fetching per active tab ────────────────────────────────────────────

  // Departments and positions are needed for overview (edit) and employment tabs
  const needDeptPos = canManage || tab === "employment";
  const [departments, positions, managers] = needDeptPos
    ? await Promise.all([
        listActiveDepartments(),
        listActivePositions(),
        canManage ? listAssignableManagers(employee.id) : Promise.resolve([]),
      ])
    : [[], [], []];

  // Contracts — with expiring-soon flag
  const today = new Date();
  const thirtyDaysOut = new Date(today);
  thirtyDaysOut.setDate(today.getDate() + 30);
  const contractRows =
    tabPerms.canViewContracts && "contracts" in employee && Array.isArray(employee.contracts)
      ? (employee.contracts as Array<{
          id: string; employeeId: string; contractType: string;
          startDate: Date; endDate: Date | null; status: string;
          remarks: string | null; createdAt: Date; updatedAt: Date;
        }>).map((c) => ({
          ...c,
          isExpiringSoon:
            c.status === "ACTIVE" &&
            c.endDate !== null &&
            c.endDate <= thirtyDaysOut &&
            c.endDate >= today,
        }))
      : [];

  // Attendance
  const now = new Date();
  const { records: attendanceRecords, counts: attendanceCounts } =
    canViewAttendance && tab === "attendance"
      ? await getEmployeeMonthlyAttendance(employee.id, now.getFullYear(), now.getMonth() + 1)
      : { records: [], counts: { present: 0, late: 0, halfDay: 0, absent: 0, onLeave: 0, excused: 0 } };

  const monthLabel = now.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  // Leave
  const [leaveBalances, recentLeaveRequests] =
    canViewLeave && tab === "leave"
      ? await Promise.all([
          getEmployeeLeaveBalances(employee.id),
          getRecentEmployeeLeaveRequests(employee.id, 5),
        ])
      : [[], []];

  // Lifecycle
  const [lifecycleRecord, onboardingChecklist, offboardingChecklist] =
    canViewLifecycle && tab === "lifecycle"
      ? await Promise.all([
          getEmployeeLifecycleRecord(employee.id),
          getOnboardingChecklist(employee.id),
          getOffboardingChecklist(employee.id),
        ])
      : [null, null, null];

  // ── Form values for the edit form (Overview tab, admin/HR only) ─────────────
  const formValues = canManage
    ? {
        id:                           employee.id,
        employeeId:                   employee.employeeId,
        firstName:                    employee.firstName,
        middleName:                   employee.middleName ?? null,
        lastName:                     employee.lastName,
        email:                        employee.email ?? null,
        phone:                        employee.phone ?? null,
        gender:                       (employee.gender as "MALE" | "FEMALE" | null) ?? null,
        dateOfBirth:                  employee.dateOfBirth ? employee.dateOfBirth.toISOString() : null,
        maritalStatus:                employee.maritalStatus ?? null,
        address:                      employee.address ?? null,
        emergencyContactName:         employee.emergencyContactName ?? null,
        emergencyContactPhone:        employee.emergencyContactPhone ?? null,
        emergencyContactRelationship: employee.emergencyContactRelationship ?? null,
        emergencyContactAddress:      employee.emergencyContactAddress ?? null,
        departmentId:                 employee.departmentId ?? null,
        positionId:                   employee.positionId ?? null,
        managerId:                    employee.manager?.id ?? null,
        employmentType:               employee.employmentType ?? null,
        hireDate:                     employee.hireDate ? employee.hireDate.toISOString() : null,
        employmentStatus:             employee.employmentStatus as
          | "ONBOARDING" | "ACTIVE" | "ON_LEAVE" | "RESIGNED" | "RETIRED"
          | "SUSPENDED" | "TERMINATED" | "INACTIVE",
        educationLevel:               employee.educationLevel ?? null,
        fieldOfStudy:                 employee.fieldOfStudy ?? null,
        institutionName:              employee.institutionName ?? null,
        graduationYear:               employee.graduationYear ?? null,
        profileImageUrl:              employee.profileImageUrl ?? null,
      }
    : null;

  // ── Derived display values ───────────────────────────────────────────────────
  const fullName = `${employee.firstName}${employee.middleName ? ` ${employee.middleName}` : ""} ${employee.lastName}`;
  const tenure = yearsOfService(employee.hireDate);
  const statusTone = STATUS_TONE[employee.employmentStatus as keyof typeof STATUS_TONE] ?? "neutral";

  return (
    <div className="space-y-0">

      {/* ── Back + breadcrumb ────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center gap-2">
        <Link
          href="/employees"
          className="flex items-center gap-1.5 text-sm text-ink-900/50 hover:text-ink-900 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Employees
        </Link>
        <span className="text-ink-900/25">/</span>
        <span className="text-sm text-ink-900/70 truncate max-w-[200px]">{fullName}</span>
      </div>

      {/* ── Profile header ────────────────────────────────────────────────── */}
      <Card className="overflow-hidden rounded-b-none">
        {/* Brand accent strip */}
        <div className="h-1 bg-brand-700" />

        <div className="px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">

            {/* Left: avatar + name + meta */}
            <div className="flex items-start gap-4">
              <Avatar
                name={fullName}
                imageUrl={employee.profileImageUrl}
                size="xl"
                className="shrink-0"
              />
              <div className="min-w-0">
                {/* Name + status */}
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-xl font-semibold text-ink-900 sm:text-2xl">
                    {fullName}
                  </h1>
                  <Badge tone={statusTone}>
                    {STATUS_LABEL[employee.employmentStatus] ?? employee.employmentStatus}
                  </Badge>
                  {employee.deletedAt && (
                    <Badge tone="danger">Archived</Badge>
                  )}
                </div>

                {/* Employee ID */}
                <p className="mt-0.5 text-sm font-medium text-brand-700">{employee.employeeId}</p>

                {/* Position · Department */}
                <p className="mt-1 text-sm text-ink-900/60">
                  {employee.position?.name ?? "No position"}
                  {employee.department?.name ? ` · ${employee.department.name}` : ""}
                </p>

                {/* Manager */}
                {employee.manager && (
                  <p className="mt-0.5 text-sm text-ink-900/50">
                    Reports to{" "}
                    <Link
                      href={`/employees/${employee.manager.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {employee.manager.firstName} {employee.manager.lastName}
                    </Link>
                  </p>
                )}

                {/* Hire date + employment type */}
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {employee.hireDate && (
                    <span className="flex items-center gap-1 text-xs text-ink-900/45">
                      <Calendar className="h-3 w-3" aria-hidden="true" />
                      Joined {formatDate(employee.hireDate)}
                    </span>
                  )}
                  {employee.employmentType && (
                    <span className="flex items-center gap-1 text-xs text-ink-900/45">
                      <UserCircle2 className="h-3 w-3" aria-hidden="true" />
                      {EMPLOYMENT_TYPE_LABEL[employee.employmentType] ?? employee.employmentType}
                    </span>
                  )}
                  {tenure && (
                    <span className="flex items-center gap-1 text-xs text-ink-900/45">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {tenure}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: action buttons (admin/HR only) */}
            {canManage && (
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <ButtonLink
                  href={`/employees/${employee.id}?tab=overview`}
                  variant="outline"
                  size="sm"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  Edit
                </ButtonLink>
                {canManageHistory && (
                  <ButtonLink
                    href={`/employees/${employee.id}?tab=employment`}
                    variant="outline"
                    size="sm"
                  >
                    <History className="h-3.5 w-3.5" aria-hidden="true" />
                    Employment
                  </ButtonLink>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* ── Tab navigation ───────────────────────────────────────────────── */}
      <Suspense fallback={null}>
        <ProfileTabs employeeId={employee.id} visibleTabs={visibleTabs} />
      </Suspense>

      {/* ── Tab content ──────────────────────────────────────────────────── */}
      <div className="mt-5 space-y-5">

        {/* ══ OVERVIEW ══════════════════════════════════════════════════ */}
        {tab === "overview" && (
          <>
            <OverviewPanel
              employee={employee}
              formValues={formValues}
              canManage={canManage}
              departments={departments}
              positions={positions}
              managers={managers}
              updateAction={updateEmployee.bind(null, employee.id)}
            />
            {/* System Account — Admin only */}
            {canManageUsers && (
              <SystemAccountPanel
                employeeId={employee.id}
                employeeCode={employee.employeeId}
                linkedUser={
                  "user" in employee && employee.user
                    ? (employee.user as { id: string; username: string | null; role: string; banned: boolean; mustChangePassword: boolean })
                    : null
                }
                canManage={canManageUsers}
              />
            )}
          </>
        )}

        {/* ══ EMPLOYMENT ════════════════════════════════════════════════ */}
        {tab === "employment" && (
          <>
            <EmploymentPanel
              employeeId={employee.id}
              department={employee.department}
              position={employee.position}
              manager={employee.manager}
              employmentType={employee.employmentType}
              hireDate={employee.hireDate}
              employmentStatus={employee.employmentStatus}
              history={employee.employmentHistory}
              departments={departments}
              positions={positions}
              currentDepartmentId={employee.departmentId ?? ""}
              canManage={canManageHistory}
              linkedUser={"user" in employee && employee.user ? (employee.user as { id: string; role: string }) : null}
              canChangeRole={canChangeRole}
            />

            {/* Contracts — only for full viewers, shown inside employment tab */}
            {tabPerms.canViewContracts && contractRows.length > 0 && (
              <Card>
                <CardHeaderImport title="Contracts" description="Employment contracts. Creating a new contract automatically closes the previous active one." />
                <div className="px-5 pb-5">
                  <ContractsPanelImport
                    employeeId={employee.id}
                    contracts={contractRows}
                    canManage={canManageContracts}
                  />
                </div>
              </Card>
            )}
            {tabPerms.canViewContracts && canManageContracts && contractRows.length === 0 && (
              <Card>
                <CardHeaderImport title="Contracts" />
                <div className="px-5 pb-5">
                  <ContractsPanelImport
                    employeeId={employee.id}
                    contracts={[]}
                    canManage={canManageContracts}
                  />
                </div>
              </Card>
            )}
          </>
        )}

        {/* ══ ATTENDANCE ════════════════════════════════════════════════ */}
        {tab === "attendance" && canViewAttendance && (
          <AttendancePanel
            records={attendanceRecords}
            counts={attendanceCounts}
            monthLabel={monthLabel}
            employeeId={employee.id}
          />
        )}

        {/* ══ LEAVE ═════════════════════════════════════════════════════ */}
        {tab === "leave" && canViewLeave && (
          <LeavePanel
            balances={leaveBalances}
            recentRequests={recentLeaveRequests}
            year={now.getFullYear()}
          />
        )}

        {/* ══ DOCUMENTS ═════════════════════════════════════════════════ */}
        {tab === "documents" && tabPerms.canViewDocuments && (
          <DocumentsPanel
            employeeId={employee.id}
            documents={"documents" in employee ? (employee.documents as Document[]) : []}
            canManage={canManageDocuments}
          />
        )}

        {/* ══ LIFECYCLE ═════════════════════════════════════════════════ */}
        {tab === "lifecycle" && canViewLifecycle && onboardingChecklist && offboardingChecklist && (
          <LifecyclePanel
            employeeId={employee.id}
            employmentStatus={employee.employmentStatus}
            checklist={onboardingChecklist}
            offboardingChecklist={offboardingChecklist}
            onboardingRecord={lifecycleRecord?.onboardingRecord ?? null}
            offboardingRecord={lifecycleRecord?.offboardingRecord
              ? {
                  reason:          lifecycleRecord.offboardingRecord.reason as OffboardingReasonValue,
                  lastWorkingDate: lifecycleRecord.offboardingRecord.lastWorkingDate,
                  startedAt:       lifecycleRecord.offboardingRecord.startedAt,
                  completedAt:     lifecycleRecord.offboardingRecord.completedAt,
                  notes:           lifecycleRecord.offboardingRecord.notes,
                  startedBy:       lifecycleRecord.offboardingRecord.startedBy,
                  completedBy:     lifecycleRecord.offboardingRecord.completedBy,
                }
              : null
            }
            canManage={canManage}
            canManageOnboarding={canManageOnboarding}
            canManageOffboarding={canManageOffboarding}
            cancelOffboardingAction={cancelOffboarding.bind(null, employee.id)}
            employmentHistory={employee.employmentHistory}
            hireDate={employee.hireDate}
          />
        )}

        {tab === "lifecycle" && !canViewLifecycle && (
          <EmptyState
            title="Access restricted"
            description="You do not have permission to view lifecycle information."
          />
        )}
      </div>
    </div>
  );
}
