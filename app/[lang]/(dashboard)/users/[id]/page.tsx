import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePermission } from "@/lib/session";
import { getUserById } from "@/features/users/queries";
import { roleLabel } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EditUserForm } from "./EditUserForm";
import { AccountSecurityPanel } from "@/features/users/account-security-panel";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission("MANAGE_USERS");
  const { id } = await params;

  const user = await getUserById(id);
  if (!user) notFound();

  const isSelf = user.id === session.user.id;
  const emp = user.employee;

  return (
    <div className="max-w-2xl space-y-6">
      {/* ── Account header ──────────────────────────────────────── */}
      <div className="flex items-start gap-4">
        <Avatar name={user.name} imageUrl={user.image} size="lg" />
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold text-ink-900">{user.name}</h2>
          {user.username && (
            <p className="mt-0.5 text-sm text-ink-900/50">@{user.username}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone="brand">{roleLabel(user.role)}</Badge>
            {user.banned
              ? <Badge tone="warning">Suspended</Badge>
              : <Badge tone="success">Active</Badge>}
            {user.mustChangePassword && (
              <Badge tone="warning">Must change password</Badge>
            )}
          </div>
          <p className="mt-1.5 text-xs text-ink-900/45">
            Account created {formatDate(user.createdAt)}
          </p>

          {/* Linked employee */}
          {emp ? (
            <p className="mt-1 text-sm text-ink-900/60">
              Employee:{" "}
              <Link
                href={`/employees/${emp.id}`}
                className="font-medium text-brand-700 hover:underline"
              >
                {emp.firstName} {emp.lastName} ({emp.employeeId})
              </Link>
              {emp.deletedAt && (
                <span className="ml-1.5 text-xs text-ink-900/40">(archived)</span>
              )}
            </p>
          ) : (
            <p className="mt-1 text-sm italic text-ink-900/40">Not linked to an employee record</p>
          )}
        </div>
      </div>

      {/* ── Edit account details ─────────────────────────────────── */}
      <Card className="p-6">
        <h3 className="mb-5 border-b border-ink-900/8 pb-4 font-display text-base font-semibold text-ink-900">
          Account Details
        </h3>
        <EditUserForm
          user={{
            id: user.id,
            name: user.name,
            username: user.username,
            role: user.role,
            image: user.image,
          }}
        />
      </Card>

      {/* ── Security & access — only shown for other accounts, not the current admin ── */}
      {!isSelf && (
        <AccountSecurityPanel
          userId={user.id}
          isSuspended={user.banned}
          mustChangePassword={user.mustChangePassword}
        />
      )}
    </div>
  );
}
