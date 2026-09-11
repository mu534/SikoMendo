import Link from "next/link";
import {
  Shield,
  CheckCircle2,
  Users,
  Lock,
  AlertTriangle,
  ShieldCheck,
  Clock,
  UserX,
  KeyRound,
  ExternalLink,
  Activity,
} from "lucide-react";
import { requirePermission } from "@/lib/session";
import prisma from "@/lib/prisma";
import { ROLE_LABELS, PERMISSIONS, type Role } from "@/lib/permissions";
import { formatDateTime } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ── Security summary — live counts from the database ─────────────────────────

async function getSecuritySummary() {
  const [totalAccounts, suspended, pendingPasswordChange, recentSecurityEvents] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { banned: true } }),
      prisma.user.count({ where: { mustChangePassword: true } }),
      // The last 6 security-relevant actions on the User entity
      prisma.auditLog.findMany({
        where: {
          entity: "User",
          action: {
            in: [
              "CREATE",
              "SUSPEND",
              "REACTIVATE",
              "PASSWORD_RESET",
              "FORCE_PASSWORD_CHANGE",
              "PASSWORD_CHANGED",
              "DEACTIVATE",
            ],
          },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          action: true,
          entityId: true,
          createdAt: true,
          user: { select: { name: true, username: true } },
          changes: true,
        },
      }),
    ]);

  return {
    totalAccounts,
    activeAccounts: totalAccounts - suspended,
    suspended,
    pendingPasswordChange,
    recentSecurityEvents,
  };
}

// ── Friendly label for audit actions on the security page ────────────────────

const SECURITY_EVENT_LABELS: Record<string, string> = {
  CREATE:               "Account created",
  SUSPEND:              "Account suspended",
  REACTIVATE:           "Account reactivated",
  PASSWORD_RESET:       "Password reset by admin",
  FORCE_PASSWORD_CHANGE:"Password change required",
  PASSWORD_CHANGED:     "Password changed",
  DEACTIVATE:           "Account deactivated",
};

const SECURITY_EVENT_TONES: Record<string, "success" | "warning" | "danger" | "neutral" | "brand"> = {
  CREATE:               "success",
  REACTIVATE:           "success",
  PASSWORD_CHANGED:     "brand",
  FORCE_PASSWORD_CHANGE:"brand",
  PASSWORD_RESET:       "brand",
  SUSPEND:              "danger",
  DEACTIVATE:           "neutral",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function SecuritySettingsPage() {
  await requirePermission("MANAGE_SETTINGS");

  const {
    totalAccounts,
    activeAccounts,
    suspended,
    pendingPasswordChange,
    recentSecurityEvents,
  } = await getSecuritySummary();

  // Session expiry is a constant from auth config — 7 days (60 * 60 * 24 * 7 seconds)
  // Rate limiting: /sign-in/username — 20 attempts per 5 minutes, enforced by auth layer
  // Minimum password length: 8 characters (enforced at account creation)

  return (
    <div className="space-y-6">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">Security &amp; Access</h2>
        <p className="mt-1 text-sm text-ink-900/60">
          Active security controls and account status for the Siko Mendo Union HRMIS.
        </p>
      </div>

      <div className="max-w-3xl space-y-5">

        {/* ── Authentication ────────────────────────────────────────────────── */}
        <Card>
          <CardHeader
            title="Authentication"
            action={
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Active
              </div>
            }
          />
          <div className="divide-y divide-ink-900/6 px-6 pb-2">
            <SecurityRow
              icon={<Lock className="h-4 w-4" />}
              label="Sign-in method"
              value="Username and password"
              detail="Email-based sign-in is not exposed. All accounts use a username credential."
            />
            <SecurityRow
              icon={<Shield className="h-4 w-4" />}
              label="Password security"
              value="Securely hashed"
              detail="Passwords are never stored in plaintext. Minimum 8 characters required."
            />
            <SecurityRow
              icon={<Clock className="h-4 w-4" />}
              label="Session expiry"
              value="7 days"
              detail="Sessions expire after 7 days of inactivity and refresh automatically on daily use."
            />
            <SecurityRow
              icon={<KeyRound className="h-4 w-4" />}
              label="Forced password change"
              value="Enabled"
              detail="All new accounts must set their own password on first sign-in."
            />
            <SecurityRow
              icon={<UserX className="h-4 w-4" />}
              label="Account suspension"
              value="Supported"
              detail="Suspending an account immediately blocks sign-in and invalidates existing sessions."
            />
            <SecurityRow
              icon={<AlertTriangle className="h-4 w-4" />}
              label="Sign-in rate limiting"
              value="20 attempts per 5 minutes"
              detail="Applied per IP address on the sign-in endpoint to slow automated guessing attempts."
            />
          </div>
        </Card>

        {/* ── Access Control ────────────────────────────────────────────────── */}
        <Card>
          <CardHeader
            title="Access Control"
            action={
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Active
              </div>
            }
          />
          <div className="divide-y divide-ink-900/6 px-6 pb-2">
            <SecurityRow
              icon={<Users className="h-4 w-4" />}
              label="Role-based access"
              value={`${Object.keys(PERMISSIONS).length} roles defined`}
              detail={
                <span className="flex flex-wrap gap-1.5 pt-0.5">
                  {(Object.keys(PERMISSIONS) as Role[]).map((role) => (
                    <span
                      key={role}
                      className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800"
                    >
                      {ROLE_LABELS[role]}
                    </span>
                  ))}
                </span>
              }
            />
            <SecurityRow
              icon={<Shield className="h-4 w-4" />}
              label="Server-side authorisation"
              value="Enforced on every action"
              detail="All data mutations pass through a permission check on the server before executing. UI visibility is supplementary only."
            />
            <SecurityRow
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Audit logging"
              value="Enabled"
              detail="Account changes, access events, and all data mutations are recorded with actor and timestamp."
            />
            <SecurityRow
              icon={<Users className="h-4 w-4" />}
              label="Manager data scope"
              value="Restricted to reporting hierarchy"
              detail="General Manager accounts only see employees in their own reporting hierarchy. This is enforced server-side on all queries and reports."
            />
          </div>
        </Card>

        {/* ── Account Status ────────────────────────────────────────────────── */}
        <Card>
          <CardHeader
            title="Account Status"
            description="Live counts from the user directory."
            action={
              <Link
                href="/users"
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
              >
                Manage accounts
                <ExternalLink className="h-3 w-3" />
              </Link>
            }
          />
          <div className="grid grid-cols-2 gap-px bg-ink-900/8 border-t border-ink-900/8 sm:grid-cols-4">
            <AccountStat
              label="Total accounts"
              value={totalAccounts}
              tone="neutral"
            />
            <AccountStat
              label="Active"
              value={activeAccounts}
              tone="success"
            />
            <AccountStat
              label="Suspended"
              value={suspended}
              tone={suspended > 0 ? "danger" : "neutral"}
              action={
                suspended > 0
                  ? { href: "/users/suspended", label: "View" }
                  : undefined
              }
            />
            <AccountStat
              label="Pending password change"
              value={pendingPasswordChange}
              tone={pendingPasswordChange > 0 ? "warning" : "neutral"}
              action={
                pendingPasswordChange > 0
                  ? { href: "/users", label: "View" }
                  : undefined
              }
            />
          </div>
        </Card>

        {/* ── Security Activity ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader
            title="Recent Security Activity"
            description="Latest account-related events recorded in the audit log."
            action={
              <Link
                href="/audit-log?entity=User"
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
              >
                Full audit log
                <ExternalLink className="h-3 w-3" />
              </Link>
            }
          />

          {recentSecurityEvents.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <Activity className="mx-auto h-7 w-7 text-ink-900/20" />
              <p className="mt-2 text-sm text-ink-900/50">No security events recorded yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-ink-900/6">
              {recentSecurityEvents.map((event) => {
                const label = SECURITY_EVENT_LABELS[event.action] ?? event.action;
                const tone  = SECURITY_EVENT_TONES[event.action]  ?? "neutral";
                const changes = event.changes as Record<string, unknown> | null;
                // Try to extract a human-readable subject from the changes JSON
                const subject =
                  (changes?.name as string | undefined) ??
                  (changes?.username as string | undefined) ??
                  null;

                return (
                  <li key={event.id} className="flex items-center gap-4 px-6 py-3">
                    <Badge tone={tone} className="shrink-0">
                      {label}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      {subject && (
                        <p className="truncate text-sm font-medium text-ink-900">{subject}</p>
                      )}
                      <p className="text-xs text-ink-900/45">
                        {event.user
                          ? `By ${event.user.name}${event.user.username ? ` (@${event.user.username})` : ""}`
                          : "System"}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs text-ink-900/40 tabular-nums">
                      {formatDateTime(event.createdAt)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border-t border-ink-900/6 px-6 py-3">
            <Link
              href="/audit-log?entity=User"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:underline"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              View all security events in audit log
            </Link>
          </div>
        </Card>

      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SecurityRow({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 py-4">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <p className="text-sm font-medium text-ink-900">{label}</p>
          <p className="text-sm text-ink-900/55">{value}</p>
        </div>
        {detail && (
          <div className="mt-0.5 text-xs leading-relaxed text-ink-900/45">{detail}</div>
        )}
      </div>
    </div>
  );
}

function AccountStat({
  label,
  value,
  tone,
  action,
}: {
  label: string;
  value: number;
  tone: "success" | "danger" | "warning" | "neutral";
  action?: { href: string; label: string };
}) {
  const valueColour =
    tone === "success" ? "text-emerald-600" :
    tone === "danger"  ? "text-red-600" :
    tone === "warning" ? "text-gold-600" :
    "text-ink-900";

  return (
    <div className="flex flex-col gap-1 bg-white px-5 py-4">
      <p className="text-xs font-medium text-ink-900/45">{label}</p>
      <p className={`font-display text-2xl font-semibold tabular-nums ${valueColour}`}>
        {value}
      </p>
      {action && value > 0 && (
        <Link
          href={action.href}
          className="mt-0.5 text-xs font-medium text-brand-700 hover:underline"
        >
          {action.label} →
        </Link>
      )}
    </div>
  );
}
