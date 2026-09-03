import { Building2, Calendar, KeyRound, Mail, MapPin, Phone, Shield, User } from "lucide-react";
import { requireSession } from "@/lib/session";
import { roleLabel } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { formatDateWithEthiopian } from "@/lib/ethiopian-calendar";
import { formatDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  UpdateProfileForm,
  ChangePasswordForm,
  EmployeeContactForm,
} from "@/features/profile/profile-forms";

// ── Helpers ───────────────────────────────────────────────────────────────────

function yearsOfService(hireDate: Date | null): string | null {
  if (!hireDate) return null;
  const now = new Date();
  let years = now.getFullYear() - hireDate.getFullYear();
  const hadAnniversary =
    now.getMonth() > hireDate.getMonth() ||
    (now.getMonth() === hireDate.getMonth() && now.getDate() >= hireDate.getDate());
  if (!hadAnniversary) years -= 1;
  if (years < 1) return "< 1 year";
  return `${years} yr${years === 1 ? "" : "s"}`;
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sand-100 text-ink-900/40">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <dt className="text-xs font-medium uppercase tracking-wide text-ink-900/40">{label}</dt>
        <dd className="mt-0.5 truncate text-sm text-ink-900/80">{value || "—"}</dd>
      </div>
    </div>
  );
}

function ReadField({
  label,
  value,
  className,
}: {
  label: string;
  value?: string | null | React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-900/40">{label}</dt>
      <dd className="mt-1 text-sm text-ink-900/80">{value ?? "—"}</dd>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-ink-900/40">
      {children}
    </h3>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ProfilePage() {
  const session = await requireSession();
  const { user } = session;

  // firstName/middleName/lastName are not on the session object — fetch separately
  const userRecord = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      firstName: true,
      middleName: true,
      lastName: true,
      passwordChangedAt: true,
      createdAt: true,
    },
  });

  const employee = await prisma.employee.findUnique({
    where: { userId: user.id },
    include: {
      department: { select: { name: true } },
      position: { select: { name: true } },
      manager: { select: { firstName: true, lastName: true } },
    },
  });

  const typedUser = user as typeof user & { username?: string | null };
  const tenure = employee?.hireDate ? yearsOfService(employee.hireDate) : null;

  const statusTone =
    employee?.employmentStatus === "ACTIVE"
      ? "success"
      : employee?.employmentStatus === "ON_LEAVE"
        ? "warning"
        : "neutral";

  return (
    <div className="space-y-6">
      {/* ── Page title ────────────────────────────────────────────────────── */}
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">My Profile</h2>
        <p className="mt-1 text-sm text-ink-900/55">
          Manage your personal information, contact details, and security settings.
        </p>
      </div>

      {/* ── Hero header card ──────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        {/* Subtle top accent stripe */}
        <div className="h-1.5 bg-brand-700" />

        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:justify-between">
          {/* Left: avatar + identity */}
          <div className="flex items-start gap-5">
            <Avatar
              name={user.name}
              imageUrl={employee?.profileImageUrl ?? user.image}
              size="xl"
            />
            <div className="min-w-0">
              <h3 className="font-display text-xl font-semibold text-ink-900 sm:text-2xl">
                {user.name}
              </h3>
              {typedUser.username && (
                <p className="mt-0.5 text-sm text-ink-900/50">@{typedUser.username}</p>
              )}
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <Badge tone="brand">{roleLabel(user.role)}</Badge>
                {employee && (
                  <Badge tone={statusTone}>
                    {employee.employmentStatus.replace(/_/g, " ")}
                  </Badge>
                )}
                {user.banned && <Badge tone="danger">Suspended</Badge>}
                {employee && <Badge tone="neutral">{employee.employeeId}</Badge>}
              </div>
            </div>
          </div>

          {/* Right: quick-stats */}
          {employee && (
            <div className="flex shrink-0 flex-wrap gap-x-8 gap-y-3 sm:flex-col sm:items-end sm:gap-y-3 sm:border-l sm:border-ink-900/8 sm:pl-6">
              <div className="sm:text-right">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-900/40">
                  Position
                </p>
                <p className="mt-0.5 text-sm font-medium text-ink-900">
                  {employee.position.name}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-900/40">
                  Department
                </p>
                <p className="mt-0.5 text-sm font-medium text-ink-900">
                  {employee.department.name}
                </p>
              </div>
              {tenure && (
                <div className="sm:text-right">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-900/40">
                    Tenure
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-ink-900">{tenure}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* ── Body: two-column layout ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">

        {/* ── Left column (narrower) ───────────────────── */}
        <div className="space-y-6 lg:col-span-2">

          {/* Account summary */}
          <Card className="p-6">
            <SectionTitle>Account</SectionTitle>
            <dl className="space-y-4">
              <InfoRow icon={User} label="Username" value={typedUser.username ? `@${typedUser.username}` : undefined} />
              <InfoRow icon={Mail} label="Email" value={user.email} />
              <InfoRow icon={Shield} label="Role" value={roleLabel(user.role)} />
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sand-100 text-ink-900/40">
                  <Calendar className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-900/40">Member since</dt>
                  <dd className="mt-0.5 text-sm text-ink-900/80">
                    {userRecord?.createdAt ? formatDate(userRecord.createdAt) : "—"}
                  </dd>
                </div>
              </div>
            </dl>
          </Card>

          {/* Contact quick-view (if employee exists) */}
          {employee && (
            <Card className="p-6">
              <SectionTitle>Contact</SectionTitle>
              <dl className="space-y-4">
                <InfoRow icon={Phone} label="Phone" value={employee.phone} />
                <InfoRow icon={Mail} label="Work email" value={employee.email} />
                <InfoRow icon={MapPin} label="Address" value={employee.address} />
                {employee.manager && (
                  <InfoRow
                    icon={User}
                    label="Reports to"
                    value={`${employee.manager.firstName} ${employee.manager.lastName}`}
                  />
                )}
              </dl>
            </Card>
          )}

          {/* Employment quick-view */}
          {employee && (
            <Card className="p-6">
              <SectionTitle>Employment</SectionTitle>
              <dl className="space-y-4">
                <InfoRow icon={Building2} label="Department" value={employee.department.name} />
                <InfoRow icon={User} label="Position" value={employee.position.name} />
                <InfoRow
                  icon={Calendar}
                  label="Date hired"
                  value={formatDateWithEthiopian(employee.hireDate)}
                />
                {employee.employmentType && (
                  <InfoRow icon={Building2} label="Type" value={employee.employmentType} />
                )}
              </dl>
            </Card>
          )}
        </div>

        {/* ── Right column (wider — edit forms) ────────── */}
        <div className="space-y-6 lg:col-span-3">

          {/* Personal Information — edit name */}
          <Card className="p-6">
            <div className="mb-5 border-b border-ink-900/8 pb-4">
              <h3 className="font-display text-base font-semibold text-ink-900">
                Personal Information
              </h3>
              <p className="mt-1 text-sm text-ink-900/55">
                Update your display name. Username and role are managed by an Administrator.
              </p>
            </div>
            <UpdateProfileForm
              name={user.name}
              firstName={userRecord?.firstName}
              middleName={userRecord?.middleName}
              lastName={userRecord?.lastName}
            />
          </Card>

          {/* Contact & photo — only when employee record exists */}
          {employee ? (
            <Card className="p-6">
              <div className="mb-5 border-b border-ink-900/8 pb-4">
                <h3 className="font-display text-base font-semibold text-ink-900">
                  Contact Information
                </h3>
                <p className="mt-1 text-sm text-ink-900/55">
                  Keep your contact details and emergency contact up to date.
                </p>
              </div>
              <EmployeeContactForm
                name={user.name}
                image={employee.profileImageUrl}
                phone={employee.phone}
                email={employee.email}
                address={employee.address}
                emergencyContactName={employee.emergencyContactName}
                emergencyContactPhone={employee.emergencyContactPhone}
                emergencyContactRelationship={employee.emergencyContactRelationship}
                emergencyContactAddress={employee.emergencyContactAddress}
              />
            </Card>
          ) : (
            <Card className="p-6">
              <div className="mb-5 border-b border-ink-900/8 pb-4">
                <h3 className="font-display text-base font-semibold text-ink-900">
                  Contact Information
                </h3>
              </div>
              <p className="text-sm text-ink-900/55">
                No employee record is linked to your account yet. Contact HR to link one
                so you can manage your contact details and profile photo here.
              </p>
            </Card>
          )}

          {/* Employment details — read-only (only when employee record exists) */}
          {employee && (
            <Card className="p-6">
              <div className="mb-5 border-b border-ink-900/8 pb-4">
                <h3 className="font-display text-base font-semibold text-ink-900">
                  Employment Details
                </h3>
                <p className="mt-1 text-sm text-ink-900/55">
                  Managed by HR. Contact your HR Officer to request changes.
                </p>
              </div>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
                <ReadField label="Employee ID" value={employee.employeeId} />
                <ReadField label="Department" value={employee.department.name} />
                <ReadField label="Position" value={employee.position.name} />
                <ReadField label="Employment Type" value={employee.employmentType?.replace(/_/g, " ")} />
                <ReadField
                  label="Employment Status"
                  value={
                    <Badge tone={statusTone} className="mt-0.5">
                      {employee.employmentStatus.replace(/_/g, " ")}
                    </Badge>
                  }
                />
                <ReadField
                  label="Date Hired"
                  value={formatDateWithEthiopian(employee.hireDate)}
                />
                {employee.manager && (
                  <ReadField
                    label="Reports To"
                    value={`${employee.manager.firstName} ${employee.manager.lastName}`}
                    className="sm:col-span-2"
                  />
                )}
                {employee.gender && (
                  <ReadField label="Gender" value={employee.gender} />
                )}
                {employee.maritalStatus && (
                  <ReadField label="Marital Status" value={employee.maritalStatus} />
                )}
                {employee.dateOfBirth && (
                  <ReadField
                    label="Date of Birth"
                    value={formatDateWithEthiopian(employee.dateOfBirth)}
                  />
                )}
                {employee.educationLevel && (
                  <ReadField label="Education Level" value={employee.educationLevel.replace(/_/g, " ")} />
                )}
                {employee.fieldOfStudy && (
                  <ReadField label="Field of Study" value={employee.fieldOfStudy} />
                )}
                {employee.institutionName && (
                  <ReadField label="Institution" value={employee.institutionName} />
                )}
                {employee.graduationYear && (
                  <ReadField label="Graduation Year" value={employee.graduationYear} />
                )}
              </dl>
            </Card>
          )}

          {/* Security — change password */}
          <Card className="p-6">
            <div className="mb-5 border-b border-ink-900/8 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <KeyRound className="h-4 w-4" />
                </div>
                <h3 className="font-display text-base font-semibold text-ink-900">
                  Security
                </h3>
              </div>
              <p className="mt-2 text-sm text-ink-900/55">
                Choose a strong password of at least 8 characters.
                {userRecord?.passwordChangedAt && (
                  <> Last changed {formatDate(userRecord.passwordChangedAt)}.</>
                )}
              </p>
            </div>
            <ChangePasswordForm />
          </Card>

          {/* Permissions — read-only role info */}
          <Card className="p-6">
            <div className="mb-4 border-b border-ink-900/8 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <Shield className="h-4 w-4" />
                </div>
                <h3 className="font-display text-base font-semibold text-ink-900">
                  Permissions
                </h3>
              </div>
            </div>
            <p className="text-sm text-ink-900/60">
              Your current role is{" "}
              <span className="font-medium text-ink-900">{roleLabel(user.role)}</span>.
              Roles determine what you can view and do in the system. Contact your
              Administrator to request a role change.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="brand">{roleLabel(user.role)}</Badge>
              {user.banned ? (
                <Badge tone="danger">Account Suspended</Badge>
              ) : (
                <Badge tone="success">Account Active</Badge>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
