import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, type AuthSession } from "@/lib/auth";
import { can, type Action } from "@/lib/permissions";

/** Reads the current session on the server. Returns null when signed out. */
export async function getServerSession(): Promise<AuthSession | null> {
  return auth.api.getSession({ headers: await headers() });
}

/** Use in layouts/pages that require any authenticated user. Redirects otherwise. */
export async function requireSession(): Promise<AuthSession> {
  const session = await getServerSession();
  if (!session) {
    redirect("/sign-in");
  }
  return session;
}

/**
 * Use in layouts/pages that require a specific permission.
 * Redirects unauthenticated users to sign-in, and signed-in users who lack
 * the permission to their dashboard with nowhere further to go.
 */
export async function requirePermission(action: Action): Promise<AuthSession> {
  const session = await requireSession();
  if (!can(session.user.role, action)) {
    redirect("/dashboard");
  }
  return session;
}
