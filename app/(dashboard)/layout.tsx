import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { resolveEffectiveRole } from "@/lib/employee-access";
import type { Role } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { getRecentNotifications } from "@/features/notifications/queries";
import { getOrgSettings } from "@/features/settings/queries";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  const flags = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { mustChangePassword: true },
  });
  if (flags?.mustChangePassword) {
    redirect("/force-password-change");
  }

  const [notifications, orgSettings, effectiveRole] = await Promise.all([
    getRecentNotifications(session.user.id),
    getOrgSettings(),
    resolveEffectiveRole(session.user.id, session.user.role as Role),
  ]);

  return (
    <DashboardShell
      user={{
        name: session.user.name,
        email: session.user.email,
        role: effectiveRole,
        image: session.user.image,
      }}
      notifications={notifications}
      org={{
        orgName:  orgSettings.orgName,
        tagline:  orgSettings.tagline,
        location: orgSettings.location,
        logoUrl:  orgSettings.logoUrl,
      }}
    >
      {children}
    </DashboardShell>
  );
}
