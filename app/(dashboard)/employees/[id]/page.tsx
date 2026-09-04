import { notFound } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  Trash2,
  User,
  Phone,
  Briefcase,
  GraduationCap,
  Calendar,
  History,
  ScrollText,
} from "lucide-react";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getEmployeeById, listAssignableManagers } from "@/features/employees/queries";
import { updateEmployee, deleteEmployeeDocument } from "@/features/employees/actions";
import { EmployeeForm, EmployeeFormActions } from "@/features/employees/employee-form";
import { SectionHeader } from "@/features/employees/section-header";
import { DocumentUploadForm } from "@/features/employees/document-upload-form";
import { EmploymentHistoryPanel } from "@/features/employment-history/employment-history-panel";
import { ContractsPanel } from "@/features/contracts/contracts-panel";
import { listActiveDepartments } from "@/features/departments/queries";
import { listActivePositions } from "@/features/positions/queries";
import { formatDate, formatBytes } from "@/lib/utils";
import { formatDateWithEthiopian } from "@/lib/ethiopian-calendar";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import type { Document } from "@prisma/client";
import { getSignedFileUrl } from "@/lib/cloudinary";

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
  const canManageHistory = can(session.user.role, "MANAGE_EMPLOYMENT_HISTORY");
  const canManageContracts = can(session.user.role, "MANAGE_CONTRACTS");

  const [departments, positions, managers] = canManage
    ? await Promise.all([
        listActiveDepartments(),
        listActivePositions(),
        listAssignableManagers(employee.id),
      ])
    : [[], [], []];

  // Shape contracts for the panel — add isExpiringSoon flag
  const today = new Date();
  const thirtyDaysOut = new Date(today);
  thirtyDaysOut.setDate(today.getDate() + 30);
  const contractRows = employee.contracts.map((c) => ({
    ...c,
    isExpiringSoon:
      c.status === "ACTIVE" &&
      c.endDate !== null &&
      c.endDate <= thirtyDaysOut &&
      c.endDate >= today,
  }));

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
        departmentId: employee.departmentId ?? null,
        positionId: employee.positionId ?? null,
        managerId: employee.manager?.id ?? null,
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
      }
    : null;

  return (
    <div className="space-y-6">
      {/* ── Profile header ─────────────────────────────────────────── */}
      <ProfileHeader employee={employee} />

      {/* ── Edit form (admin / HR) or read-only cards (manager) ───── */}
      {canManage && formValues ? (
        <EmployeeForm
          action={updateEmployee.bind(null, employee.id)}
          employee={formValues}
          departments={departments}
          positions={positions}
          managers={managers}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <SectionHeader icon={User} title="Personal Information" />
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <ReadField label="Gender" value={employee.gender} />
              <ReadField label="Date of Birth" value={formatDateWithEthiopian(employee.dateOfBirth)} />
              <ReadField label="Marital Status" value={employee.maritalStatus} />
              <ReadField label="Phone" value={employee.phone} />
              <ReadField label="Email" value={employee.email} className="sm:col-span-2" />
              <ReadField label="Address" value={employee.address} className="sm:col-span-2" />
            </dl>
          </Card>

          <Card className="p-6">
            <SectionHeader icon={Phone} title="Emergency Contact" />
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <ReadField label="Name" value={employee.emergencyContactName} />
              <ReadField label="Relationship" value={employee.emergencyContactRelationship} />
              <ReadField label="Phone" value={employee.emergencyContactPhone} />
              <ReadField label="Address" value={employee.emergencyContactAddress} />
            </dl>
          </Card>

          <Card className="p-6">
            <SectionHeader icon={Briefcase} title="Employment Information" />
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <ReadField label="Department" value={employee.department?.name} />
              <ReadField label="Position" value={employee.position?.name} />
              <ReadField label="Employment Type" value={employee.employmentType} />
              <ReadField label="Employment Status" value={employee.employmentStatus} />
              <ReadField label="Hire Date" value={formatDateWithEthiopian(employee.hireDate)} />
              <ReadField
                label="Reports To"
                value={
                  employee.manager
                    ? `${employee.manager.firstName} ${employee.manager.lastName}`
                    : null
                }
              />
            </dl>
          </Card>

          <Card className="p-6">
            <SectionHeader icon={GraduationCap} title="Education" />
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <ReadField label="Education Level" value={employee.educationLevel} />
              <ReadField label="Field of Study" value={employee.fieldOfStudy} />
              <ReadField label="Institution" value={employee.institutionName} />
              <ReadField label="Graduation Year" value={employee.graduationYear} />
            </dl>
          </Card>
        </div>
      )}

      {/* ── Employment History ─────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Employment History"
          description="A chronological record of department, position, and employment-type changes."
        />
        <div className="px-6 pb-6">
          <EmploymentHistoryPanel
            employeeId={employee.id}
            history={employee.employmentHistory}
            departments={departments}
            positions={positions}
            currentDepartmentId={employee.departmentId}
            canManage={canManageHistory}
          />
        </div>
      </Card>

      {/* ── Contracts ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Contracts"
          description="Employment contracts and their current status."
        />
        <div className="px-6 pb-6">
          <ContractsPanel
            employeeId={employee.id}
            contracts={contractRows}
            canManage={canManageContracts}
          />
        </div>
      </Card>

      {/* ── Documents ──────────────────────────────────────────────── */}
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
                  href={getSignedFileUrl(
                    doc.fileKey,
                    doc.fileResourceType === "image" || doc.fileResourceType === "raw"
                      ? doc.fileResourceType
                      : doc.mimeType.startsWith("image/")
                        ? "image"
                        : "raw",
                  )}
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

      {/* ── Save / Reset / Cancel (edit mode only) ────────────────── */}
      {canManage && <EmployeeFormActions isEdit />}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function yearsOfService(hireDate: Date | null): string | null {
  if (!hireDate) return null;
  const now = new Date();
  let years = now.getFullYear() - hireDate.getFullYear();
  const hasHadAnniversaryThisYear =
    now.getMonth() > hireDate.getMonth() ||
    (now.getMonth() === hireDate.getMonth() && now.getDate() >= hireDate.getDate());
  if (!hasHadAnniversaryThisYear) years -= 1;
  if (years < 1) return "Less than a year";
  return `${years} year${years === 1 ? "" : "s"}`;
}

function ProfileHeader({
  employee,
}: {
  employee: NonNullable<Awaited<ReturnType<typeof getEmployeeById>>>;
}) {
  const fullName = `${employee.firstName}${employee.middleName ? ` ${employee.middleName}` : ""} ${employee.lastName}`;
  const tenure = yearsOfService(employee.hireDate);

  const statusTone =
    employee.employmentStatus === "ACTIVE"
      ? "success"
      : employee.employmentStatus === "ON_LEAVE"
        ? "warning"
        : "neutral";

  return (
    <Card className="overflow-hidden">
      <div className="h-1 bg-brand-700" />
      <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-5">
          <Avatar name={fullName} imageUrl={employee.profileImageUrl} size="xl" />
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink-900">{fullName}</h2>
            <p className="mt-0.5 text-sm text-ink-900/60">
              {employee.position?.name ?? "No position assigned"}
              {employee.department?.name ? ` · ${employee.department.name}` : ""}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Badge tone="brand">{employee.employeeId}</Badge>
              <Badge tone={statusTone}>{employee.employmentStatus.replace(/_/g, " ")}</Badge>
              {employee.employmentType && (
                <Badge tone="neutral">{employee.employmentType.replace(/_/g, " ")}</Badge>
              )}
              {employee.user?.username && (
                <span className="text-xs text-ink-900/45">@{employee.user.username}</span>
              )}
              {employee.deletedAt && (
                <Badge tone="danger">Archived</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Quick-facts sidebar */}
        <div className="flex flex-wrap gap-6 sm:border-l sm:border-ink-900/8 sm:pl-6">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-900/40">
              <Calendar className="h-3.5 w-3.5" /> Tenure
            </p>
            <p className="mt-1 text-sm font-medium text-ink-900">{tenure ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-900/40">Hired</p>
            <p className="mt-1 text-sm font-medium text-ink-900">{formatDate(employee.hireDate)}</p>
          </div>
          {employee.manager && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-900/40">
                Reports to
              </p>
              <Link
                href={`/employees/${employee.manager.id}`}
                className="mt-1 block text-sm font-medium text-brand-700 hover:underline"
              >
                {employee.manager.firstName} {employee.manager.lastName}
              </Link>
            </div>
          )}
        </div>
      </div>
    </Card>
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

// Suppress unused-import warnings for icons used only in section headings
void History;
void ScrollText;
