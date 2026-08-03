import { notFound } from "next/navigation";
import Link from "next/link";
import { FileText, Trash2, CalendarOff } from "lucide-react";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getEmployeeById, listLinkableUsers, listAssignableManagers, getSubordinateIds } from "@/features/employees/queries";
import { listActiveDepartments } from "@/features/departments/queries";
import { listActivePositions } from "@/features/positions/queries";
import { updateEmployee, deleteEmployeeDocument } from "@/features/employees/actions";
import { EmployeeForm, EmployeeFormActions } from "@/features/employees/employee-form";
import { DocumentUploadForm } from "@/features/employees/document-upload-form";
import { EmployeeProfileTabs, type ProfileTab } from "@/features/employees/employee-profile-tabs";
import { ManagerPicker } from "@/features/employees/manager-picker";
import { getEmploymentHistory } from "@/features/employment-history/queries";
import { EmploymentHistoryPanel } from "@/features/employment-history/employment-history-panel";
import { getContracts } from "@/features/contracts/queries";
import { ContractsPanel } from "@/features/contracts/contracts-panel";
import { getMyAttendanceHistory, getMyAttendanceStats } from "@/features/attendance/queries";
import { listAllLeaveRequests } from "@/features/leave/queries";
import { LeaveStatusBadge } from "@/features/leave/leave-status-badge";
import { LEAVE_TYPE_LABELS } from "@/features/leave/schemas";
import { formatDate, formatBytes } from "@/lib/utils";
import { Card, CardHeader, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Table, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import prisma from "@/lib/prisma";
import type { Document } from "@prisma/client";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  if (!can(session.user.role, "VIEW_EMPLOYEES")) notFound();
  const { id } = await params;

  const employee = await getEmployeeById(id);
  if (!employee) notFound();

  // Managers only see employees within their own reporting hierarchy.
  if (session.user.role === "MANAGER") {
    const ownEmployee = await prisma.employee.findUnique({ where: { userId: session.user.id } });
    const allowedIds = ownEmployee ? await getSubordinateIds(ownEmployee.id) : [];
    if (!allowedIds.includes(id)) notFound();
  }

  const canManage = can(session.user.role, "MANAGE_EMPLOYEES");
  const canManageDocuments = can(session.user.role, "MANAGE_DOCUMENTS");
  const canManageHistory = can(session.user.role, "MANAGE_EMPLOYMENT_HISTORY");
  const canManageContracts = can(session.user.role, "MANAGE_CONTRACTS");
  const canViewLeave = can(session.user.role, "VIEW_ALL_LEAVE");

  const formValues = canManage
    ? {
        id: employee.id,
        employeeId: employee.employeeId,
        firstName: employee.firstName,
        middleName: employee.middleName ?? null,
        lastName: employee.lastName,
        email: employee.email ?? null,
        phone: employee.phone ?? null,
        gender: (employee.gender as "MALE" | "FEMALE" | null) ?? null,
        dateOfBirth: employee.dateOfBirth ? employee.dateOfBirth.toISOString() : null,
        maritalStatus: employee.maritalStatus ?? null,
        address: employee.address ?? null,
        emergencyContactName: employee.emergencyContactName ?? null,
        emergencyContactPhone: employee.emergencyContactPhone ?? null,
        emergencyContactRelationship: employee.emergencyContactRelationship ?? null,
        emergencyContactAddress: employee.emergencyContactAddress ?? null,
        departmentId: employee.departmentId,
        positionId: employee.positionId,
        employmentType: employee.employmentType ?? null,
        hireDate: employee.hireDate ? employee.hireDate.toISOString() : null,
        employmentStatus: employee.employmentStatus as
          | "ACTIVE"
          | "ON_LEAVE"
          | "RESIGNED"
          | "RETIRED"
          | "SUSPENDED"
          | "TERMINATED"
          | "INACTIVE",
        educationLevel: employee.educationLevel ?? null,
        fieldOfStudy: employee.fieldOfStudy ?? null,
        institutionName: employee.institutionName ?? null,
        graduationYear: employee.graduationYear ?? null,
        profileImageUrl: employee.profileImageUrl ?? null,
        userId: employee.userId ?? null,
      }
    : null;

  const linkableUsers = canManage ? await listLinkableUsers(employee.userId) : [];
  const [departments, positions] = canManage || canManageHistory
    ? await Promise.all([listActiveDepartments(), listActivePositions()])
    : [[], []];

  const managerOptions = canManage ? await listAssignableManagers(employee.id) : [];

  const [history, contracts, attendanceHistory, attendanceStats, leaveHistory] = await Promise.all([
    getEmploymentHistory(employee.id),
    getContracts(employee.id),
    getMyAttendanceHistory({ employeeId: employee.id, page: 1 }),
    getMyAttendanceStats(employee.id),
    canViewLeave ? listAllLeaveRequests({ employeeId: employee.id, page: 1 }) : null,
  ]);

  const overviewTab = (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card className="max-w-3xl p-6">
          <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <ReadField label="Employee ID" value={employee.employeeId} />
            <ReadField label="Gender" value={employee.gender} />
            <ReadField label="Date of Birth" value={formatDate(employee.dateOfBirth)} />
            <ReadField label="Marital Status" value={employee.maritalStatus} />
            <ReadField label="Phone" value={employee.phone} />
            <ReadField label="Email" value={employee.email} />
            <ReadField label="Address" value={employee.address} className="sm:col-span-2" />
            <ReadField label="Emergency Contact" value={employee.emergencyContactName} />
            <ReadField label="Relationship" value={employee.emergencyContactRelationship} />
            <ReadField label="Emergency Phone" value={employee.emergencyContactPhone} />
            <ReadField label="Emergency Address" value={employee.emergencyContactAddress} />
            <ReadField label="Education Level" value={employee.educationLevel} />
            <ReadField label="Field of Study" value={employee.fieldOfStudy} />
            <ReadField label="Institution" value={employee.institutionName} />
            <ReadField label="Graduation Year" value={employee.graduationYear} />
          </dl>
        </Card>
      </div>
      <div className="space-y-6">
        <Card className="p-6">
          <CardHeader title="Reporting Manager" />
          <div className="pt-3">
            {canManage ? (
              <ManagerPicker
                employeeId={employee.id}
                currentManagerId={employee.managerId}
                options={managerOptions}
              />
            ) : employee.manager ? (
              <p className="text-sm text-ink-900/80">
                {employee.manager.firstName} {employee.manager.lastName} ({employee.manager.employeeId})
              </p>
            ) : (
              <p className="text-sm text-ink-900/45">No manager assigned.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );

  const employmentTab = (
    <div className="space-y-6">
      {canManage && formValues ? (
        <EmployeeForm
          action={updateEmployee.bind(null, employee.id)}
          employee={formValues}
          linkableUsers={linkableUsers}
          departments={departments}
          positions={positions}
        />
      ) : (
        <Card className="max-w-3xl p-6">
          <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <ReadField label="Department" value={employee.department.name} />
            <ReadField label="Position" value={employee.position.name} />
            <ReadField label="Employment Type" value={employee.employmentType} />
            <ReadField label="Employment Status" value={employee.employmentStatus} />
            <ReadField label="Hire Date" value={formatDate(employee.hireDate)} />
          </dl>
        </Card>
      )}
      {canManage && <EmployeeFormActions isEdit />}
    </div>
  );

  const historyTab = (
    <EmploymentHistoryPanel
      employeeId={employee.id}
      history={history}
      departments={departments}
      positions={positions}
      currentDepartmentId={employee.departmentId}
      canManage={canManageHistory}
      formatDate={formatDate}
    />
  );

  const contractsTab = (
    <ContractsPanel
      employeeId={employee.id}
      contracts={contracts}
      canManage={canManageContracts}
      formatDate={formatDate}
    />
  );

  const attendanceTab = (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Working days" value={attendanceStats.totalWorkingDays} />
        <StatCard label="Late arrivals" value={attendanceStats.lateArrivals} />
        <StatCard label="Absences" value={attendanceStats.absences} />
        <StatCard label="Attendance rate" value={attendanceStats.attendanceRate !== null ? `${attendanceStats.attendanceRate}%` : "—"} />
      </div>
      <Card>
        <Table>
          <THead>
            <TH>Date</TH>
            <TH>Status</TH>
            <TH>Check In</TH>
            <TH>Check Out</TH>
            <TH>Notes</TH>
          </THead>
          <TBody>
            {attendanceHistory.items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-ink-900/45">
                  No attendance records yet.
                </td>
              </tr>
            )}
            {attendanceHistory.items.map((record) => (
              <TR key={record.id}>
                <TD>{formatDate(record.date)}</TD>
                <TD>
                  <Badge tone="neutral">{record.status.replace("_", " ")}</Badge>
                </TD>
                <TD>{record.checkIn ? new Date(record.checkIn).toISOString().slice(11, 16) : "—"}</TD>
                <TD>{record.checkOut ? new Date(record.checkOut).toISOString().slice(11, 16) : "—"}</TD>
                <TD>{record.notes ?? "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );

  const leaveTab = canViewLeave && leaveHistory ? (
    <Card>
      {leaveHistory.items.length === 0 ? (
        <EmptyState icon={<CalendarOff className="h-8 w-8" />} title="No leave requests yet" />
      ) : (
        <>
          <Table>
            <THead>
              <TH>Leave</TH>
              <TH>Dates</TH>
              <TH>Days</TH>
              <TH>Status</TH>
              <TH>Applied</TH>
            </THead>
            <TBody>
              {leaveHistory.items.map((leave) => (
                <TR key={leave.id}>
                  <TD>
                    <Link href={`/leave/${leave.id}`} className="font-medium text-ink-900 hover:underline">
                      {LEAVE_TYPE_LABELS[leave.leaveType]}
                    </Link>
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
          {leaveHistory.totalPages > 1 && (
            <div className="border-t border-ink-900/8 px-6 py-4">
              <Link href={`/leave?employee=${employee.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                View all {leaveHistory.total} requests →
              </Link>
            </div>
          )}
        </>
      )}
    </Card>
  ) : (
    <Card>
      <EmptyState icon={<CalendarOff className="h-8 w-8" />} title="Not available" description="You don't have permission to view this employee's leave records." />
    </Card>
  );

  const documentsTab = (
    <Card>
      <CardHeader title="Documents" description="Contracts, ID copies, certificates, and other employee files." />
      {employee.documents.length === 0 ? (
        <EmptyState icon={<FileText className="h-8 w-8" />} title="No documents yet" />
      ) : (
        <ul className="divide-y divide-ink-900/6">
          {employee.documents.map((doc: Document) => (
            <li key={doc.id} className="flex items-center justify-between gap-3 px-6 py-3.5">
              <a
                href={doc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-sm hover:underline"
              >
                <FileText className="h-4 w-4 shrink-0 text-brand-600" />
                <span>
                  <span className="font-medium text-ink-900">{doc.title}</span>
                  <span className="ml-2 text-xs text-ink-900/45">
                    {doc.type.replace("_", " ")} · {formatBytes(doc.fileSize)} · {formatDate(doc.createdAt)}
                  </span>
                </span>
              </a>
              {canManageDocuments && (
                <form
                  action={async () => {
                    "use server";
                    await deleteEmployeeDocument(doc.id, employee.id);
                  }}
                >
                  <ConfirmSubmitButton confirmMessage={`Delete "${doc.title}"?`} confirmLabel="Delete" size="sm" variant="ghost" className="text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </ConfirmSubmitButton>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      {canManageDocuments && <DocumentUploadForm employeeId={employee.id} />}
    </Card>
  );

  const tabs: ProfileTab[] = [
    { id: "overview", label: "Overview", content: overviewTab },
    { id: "employment", label: "Employment", content: employmentTab },
    { id: "history", label: "Employment History", content: historyTab },
    { id: "contracts", label: "Contracts", content: contractsTab },
    { id: "attendance", label: "Attendance", content: attendanceTab },
    { id: "leave", label: "Leave", content: leaveTab },
    { id: "documents", label: "Documents", content: documentsTab },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar name={`${employee.firstName} ${employee.lastName}`} imageUrl={employee.profileImageUrl} size="lg" />
        <div>
          <h2 className="font-display text-xl font-semibold text-ink-900">
            {employee.firstName}
            {employee.middleName ? ` ${employee.middleName}` : ""} {employee.lastName}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge tone="brand">{employee.employeeId}</Badge>
            <Badge tone="neutral">{employee.employmentStatus.replace("_", " ")}</Badge>
            {employee.user?.username && <span className="text-xs text-ink-900/50">@{employee.user.username}</span>}
          </div>
        </div>
      </div>

      <EmployeeProfileTabs tabs={tabs} />
    </div>
  );
}

function ReadField({
  label,
  value,
  className,
}: {
  label: string;
  value?: string | null;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-900/45">{label}</dt>
      <dd className="mt-1 text-sm text-ink-900/80">{value || "—"}</dd>
    </div>
  );
}
