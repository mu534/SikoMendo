import "server-only";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth, type AuthSession } from "@/lib/auth";
import { can, type Action } from "@/lib/permissions";

const LOCALES = ["en", "om"] as const;
type Locale = (typeof LOCALES)[number];
const DEFAULT_LOCALE: Locale = "en";

/**
 * Reads the NEXT_LOCALE cookie and returns a validated locale prefix like
 * "/en" or "/om". Falls back to "/en" for unknown or missing values.
 *
 * Used by server-side redirects in layouts and session helpers so that
 * redirect("/sign-in") becomes redirect("/en/sign-in") automatically.
 */
async function getLocalePrefix(): Promise<string> {
  const cookieStore = await cookies();
  const val = cookieStore.get("NEXT_LOCALE")?.value;
  const locale: Locale = (LOCALES as readonly string[]).includes(val ?? "")
    ? (val as Locale)
    : DEFAULT_LOCALE;
  return `/${locale}`;
}

/** Reads the current session on the server. Returns null when signed out. */
export async function getServerSession(): Promise<AuthSession | null> {
  return auth.api.getSession({ headers: await headers() });
}

/** Use in layouts/pages that require any authenticated user. Redirects otherwise. */
export async function requireSession(): Promise<AuthSession> {
  const session = await getServerSession();
  if (!session) {
    const prefix = await getLocalePrefix();
    redirect(`${prefix}/sign-in`);
  }
  return session;
}

/**
 * Use in layouts/pages that require a specific permission.
 * Redirects unauthenticated users to sign-in, and signed-in users who lack
 * the permission to their dashboard.
 */
export async function requirePermission(action: Action): Promise<AuthSession> {
  const session = await requireSession();
  if (!can(session.user.role, action)) {
    const prefix = await getLocalePrefix();
    redirect(`${prefix}/dashboard`);
  }
  return session;
}
