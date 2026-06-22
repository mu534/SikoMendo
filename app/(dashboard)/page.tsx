import { getSessionFromRequest } from "@/lib/auth";
import React from "react";

export default async function DashboardPage({ request }: { request?: Request }) {
  const session = await getSessionFromRequest();

  if (!session) {
    // Server-side redirect to sign-in
    return (
      <html>
        <body>
          <script dangerouslySetInnerHTML={{ __html: "window.location.href='/(auth)/sign-in'" }} />
        </body>
      </html>
    );
  }

  const userName = session.user?.name ?? session.user?.email ?? "User";

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Welcome, {userName}</h1>
      <p className="mt-4 text-sm text-zinc-600">This is the protected dashboard area.</p>
    </div>
  );
}
