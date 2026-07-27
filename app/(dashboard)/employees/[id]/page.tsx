import { notFound } from "next/navigation";
import Link from "next/link";
import { FileText, Trash2, CalendarOff } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getEmployeeById, listLinkableUsers } from "@/features/employees/queries";
import { updateEmployee, deleteEmployeeDocument } from "@/features/employees/actions";
import { EmployeeForm, EmployeeFormActions } from "@/features/employees/employee-form";
import { DocumentUploadForm } from "@/features/employees/document-upload-form";
import { listAllLeaveRequests } from "@/features/leave/queries";
import { LeaveStatusBadge } from "@/features/leave/leave-status-badge";
import { LEAVE_TYPE_LABELS } from "@/features/leave/schemas";
import { formatDate, formatBytes } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Table, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import type { Document } from "@prisma/client";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission("VIEW_EMPLOYEES");
  const { id } = await params;

  const employee = await getEmployeeById(id);
  if (!employee) notFound();

  const canManage = can(session.user.role, "MANAGE_EMPLOYEES");
  const canManageDocuments = can(session.user.role, "MANAGE_DOCUMENTS");

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
        department: employee.department ?? null,
        position: employee.position ?? null,
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

  const canViewLeave = can(session.user.role, "VIEW_ALL_LEAVE");
  const leaveHistory = canViewLeave
    ? await listAllLeaveRequests({ employeeId: employee.id, page: 1 })
    : null;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-4">
        <Avatar
          name={`${employee.firstName} ${employee.lastName}`}
          imageUrl={employee.profileImageUrl}
          size="lg"
        />
        <div>
          <h2 className="font-display text-xl font-semibold text-ink-900">
            {employee.firstName}
            {employee.middleName ? ` ${employee.middleName}` : ""} {employee.lastName}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge tone="brand">{employee.employeeId}</Badge>
            <Badge tone="neutral">{employee.employmentStatus.replace("_", " ")}</Badge>
            {employee.user?.username && (
              <span className="text-xs text-ink-900/50">@{employee.user.username}</span>
            )}
          </div>
        </div>
      </div>

      {/* Edit form (admin / HR) or read-only view (manager / employee) */}
      {canManage && formValues ? (
        <EmployeeForm
          action={updateEmployee.bind(null, employee.id)}
          employee={formValues}
          linkableUsers={linkableUsers}
        />
      ) : (
        <Card className="max-w-3xl p-6">
          <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* Personal */}
            <ReadField label="Employee ID" value={employee.employeeId} />
            <ReadField label="Gender" value={employee.gender} />
            <ReadField label="Date of Birth" value={formatDate(employee.dateOfBirth)} />
            <ReadField label="Marital Status" value={employee.maritalStatus} />
            <ReadField label="Phone" value={employee.phone} />
            <ReadField label="Email" value={employee.email} />
            <ReadField label="Address" value={employee.address} className="sm:col-span-2" />

            {/* Emergency Contact */}
            <ReadField label="Emergency Contact" value={employee.emergencyContactName} />
            <ReadField label="Relationship" value={employee.emergencyContactRelationship} />
            <ReadField label="Emergency Phone" value={employee.emergencyContactPhone} />
            <ReadField label="Emergency Address" value={employee.emergencyContactAddress} />

            {/* Employment */}
            <ReadField label="Department" value={employee.department} />
            <ReadField label="Position" value={employee.position} />
            <ReadField label="Employment Type" value={employee.employmentType} />
            <ReadField label="Employment Status" value={employee.employmentStatus} />
            <ReadField label="Hire Date" value={formatDate(employee.hireDate)} />

            {/* Education */}
            <ReadField label="Education Level" value={employee.educationLevel} />
            <ReadField label="Field of Study" value={employee.fieldOfStudy} />
            <ReadField label="Institution" value={employee.institutionName} />
            <ReadField label="Graduation Year" value={employee.graduationYear} />
          </dl>
        </Card>
      )}

      {/* Documents card */}
      <Card>
        <CardHeader
          title="Documents"
          description="Contracts, ID copies, certificates, and other employee files."
        />
        {employee.documents.length === 0 ? (
          <EmptyState icon={<FileText className="h-8 w-8" />} title="No documents yet" />
        ) : (
          <ul className="divide-y divide-ink-900/6">
            {employee.documents.map((doc: Document) => (
              <li
                key={doc.id}
                className="flex items-center justify-between gap-3 px-6 py-3.5"
              >
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
                      {doc.type.replace("_", " ")} · {formatBytes(doc.fileSize)} ·{" "}
                      {formatDate(doc.createdAt)}
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
                    <ConfirmSubmitButton
                      confirmMessage={`Delete "${doc.title}"?`}
                      confirmLabel="Delete"
                      size="sm"
                      variant="ghost"
                      className="text-red-600"
                    >
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

      {/* Leave history — visible to Admins/Managers, who can also approve/reject leave */}
      {canViewLeave && leaveHistory && (
        <Card>
          <CardHeader
            title="Leave History"
            description={`${leaveHistory.total} leave request${leaveHistory.total === 1 ? "" : "s"} on record.`}
          />
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
                  <Link
                    href={`/leave?employee=${employee.id}`}
                    className="text-sm font-medium text-brand-700 hover:underline"
                  >
                    View all {leaveHistory.total} requests →
                  </Link>
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {/* Save / Reset / Cancel — rendered after Documents so they're always at the bottom */}
      {canManage && <EmployeeFormActions isEdit />}
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