import { requireSession } from "@/lib/session";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <div className="h-full">
      <DashboardShell
        user={{
          name: session.user.name,
          email: session.user.email,
          role: session.user.role,
          image: session.user.image,
        }}
      >
        {children}
      </DashboardShell>
    </div>
  );
}
