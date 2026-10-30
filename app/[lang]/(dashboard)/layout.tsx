import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import prisma from "@/lib/prisma";
import { getRecentNotifications } from "@/features/notifications/queries";
import { getOrgSettings } from "@/features/settings/queries";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const session = await requireSession();

  const flags = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { mustChangePassword: true },
  });
  if (flags?.mustChangePassword) {
    // Use the lang from the URL segment so the redirect stays in the same locale
    redirect(`/${lang}/force-password-change`);
  }

  const [notifications, orgSettings] = await Promise.all([
    getRecentNotifications(session.user.id),
    getOrgSettings(),
  ]);

  return (
    <DashboardShell
      user={{
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
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
