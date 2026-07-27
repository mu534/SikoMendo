import { UserCircle, KeyRound, ShieldCheck } from "lucide-react";
import { requireSession } from "@/lib/session";
import { roleLabel } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UpdateProfileForm, ChangePasswordForm } from "@/features/profile/profile-forms";

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="mb-5 flex items-center gap-2.5 border-b border-ink-900/8 pb-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="font-display text-base font-semibold text-ink-900">{title}</h3>
    </div>
  );
}

export default async function ProfilePage() {
  const session = await requireSession();
  const { user } = session;

  const nameFields = await prisma.user.findUnique({
    where: { id: user.id },
    select: { firstName: true, middleName: true, lastName: true },
  });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">My Profile</h2>
        <p className="mt-1 text-sm text-ink-900/60">
          View your account information and update your personal details.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Left: Account summary card ─────────────────────────────────── */}
        <Card className="p-6 lg:col-span-1">
          <div className="flex flex-col items-center gap-3 text-center">
            <Avatar name={user.name} imageUrl={user.image} size="lg" />
            <div>
              <p className="font-display text-lg font-semibold text-ink-900">{user.name}</p>
              <p className="mt-0.5 text-sm text-ink-900/60">
              {(user as { username?: string | null }).username
                ? `@${(user as { username?: string | null }).username}`
                : user.name}
            </p>
            </div>
            <Badge tone="brand">{roleLabel(user.role)}</Badge>
          </div>

          {/* Read-only account details */}
          <dl className="mt-6 space-y-3 border-t border-ink-900/8 pt-5">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-900/45">Username</dt>
              <dd className="mt-1 text-sm text-ink-900/80">
                {(user as { username?: string | null }).username
                  ? `@${(user as { username?: string | null }).username}`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-900/45">Role</dt>
              <dd className="mt-1 text-sm text-ink-900/80">{roleLabel(user.role)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-900/45">Account status</dt>
              <dd className="mt-1">
                {user.banned ? (
                  <Badge tone="neutral">Suspended</Badge>
                ) : (
                  <Badge tone="success">Active</Badge>
                )}
              </dd>
            </div>
          </dl>
        </Card>

        {/* ── Right: Edit forms ─────────────────────────────────────────── */}
        <div className="space-y-5 lg:col-span-2">
          {/* Update name */}
          <Card className="p-6">
            <SectionHeader icon={UserCircle} title="Personal Information" />
            <p className="mb-4 text-sm text-ink-900/60">
              Your username and role are managed by an Administrator and cannot be changed here.
            </p>
            <UpdateProfileForm
              name={user.name}
              firstName={nameFields?.firstName}
              middleName={nameFields?.middleName}
              lastName={nameFields?.lastName}
              image={user.image}
            />
          </Card>

          {/* Change password */}
          <Card className="p-6">
            <SectionHeader icon={KeyRound} title="Change Password" />
            <p className="mb-4 text-sm text-ink-900/60">
              Choose a strong password of at least 8 characters.
            </p>
            <ChangePasswordForm />
          </Card>

          {/* Role info — read-only */}
          <Card className="p-6">
            <SectionHeader icon={ShieldCheck} title="Permissions" />
            <p className="text-sm text-ink-900/60">
              Your current role is{" "}
              <span className="font-medium text-ink-900">{roleLabel(user.role)}</span>. Roles
              determine what you can view and do in the system. Contact your Administrator to
              request a role change.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}