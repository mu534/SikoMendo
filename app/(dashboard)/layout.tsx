import type { Metadata } from "next";
import { getSessionFromRequest } from "@/lib/auth";
import "../globals.css";

export const metadata: Metadata = {
  title: "Dashboard | Siko Mendo HRMIS",
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionFromRequest();

  if (!session?.user) {
    return (
      <html>
        <body>
          <script dangerouslySetInnerHTML={{ __html: "window.location.href='/sign-in'" }} />
        </body>
      </html>
    );
  }

  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-zinc-50">
        <div className="flex h-full">
          {/* Sidebar */}
          <aside className="w-64 border-r border-zinc-200 bg-white">
            <div className="flex flex-col h-full">
              {/* Logo */}
              <div className="border-b border-zinc-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-zinc-900">Siko Mendo</h2>
                <p className="text-xs text-zinc-500">HRMIS</p>
              </div>

              {/* Navigation */}
              <nav className="flex-1 px-4 py-6 space-y-2 overflow-auto">
                <NavLink href="/" label="Dashboard" icon="📊" />
                <NavLink href="/users" label="Users" icon="👥" />
                <NavLink href="/employees" label="Employees" icon="👔" />
                <NavLink href="/cooperatives" label="Cooperatives" icon="🏢" />
                <NavLink href="/attendance" label="Attendance" icon="📋" />
                <NavLink href="/documents" label="Documents" icon="📄" />
                <NavLink href="/reports" label="Reports" icon="📈" />
                <NavLink href="/profile" label="My Profile" icon="⚙️" />
              </nav>

              {/* User menu footer */}
              <div className="border-t border-zinc-200 px-4 py-4">
                <div className="text-sm">
                  <p className="font-medium text-zinc-900">{session.user.name}</p>
                  <p className="text-xs text-zinc-500">{session.user.email}</p>
                </div>
              </div>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <header className="border-b border-zinc-200 bg-white px-8 py-4">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold text-zinc-900">Dashboard</h1>
                <button
                  onClick={async () => {
                    await fetch("/api/auth/sign-out", { method: "POST" });
                    window.location.href = "/sign-in";
                  }}
                  className="text-sm text-zinc-600 hover:text-zinc-900"
                >
                  Sign out
                </button>
              </div>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-auto p-8">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}

function NavLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
    >
      <span>{icon}</span>
      <span>{label}</span>
    </a>
  );
}
