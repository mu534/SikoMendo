import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import prisma from "@/lib/prisma";
import { getRecentNotifications } from "@/features/notifications/queries";
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

  const notifications = await getRecentNotifications(session.user.id);

  return (
    <div className="h-full">
      <DashboardShell
        user={{
          name: session.user.name,
          email: session.user.email,
          role: session.user.role,
          image: session.user.image,
        }}
        notifications={notifications}
      >
        {children}
      </DashboardShell>
    </div>
  );
}
