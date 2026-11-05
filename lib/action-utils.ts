import "server-only";
import type { AuthSession } from "@/lib/auth";
import { can, type Action, type Role } from "@/lib/permissions";
import { resolveEffectiveRole } from "@/lib/employee-access";
import { LocalizedError } from "@/lib/errors";

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string; code?: string } };

/**
 * Wraps a Server Action with a permission check and consistent error
 * shape. Every mutation in features/* should go through this so that
 * "is this user allowed to do this" is never accidentally skipped.
 */
export async function withPermission<T>(
  session: AuthSession | null,
  action: Action,
  handler: () => Promise<T>
): Promise<ActionResult<T>> {
  if (!session?.user) {
    return { success: false, error: { message: "You must be signed in.", code: "UNAUTHORIZED" } };
  }
  const effectiveRole = await resolveEffectiveRole(session.user.id, session.user.role as Role);
  if (!can(effectiveRole, action)) {
    return { success: false, error: { message: "You don't have permission to do that.", code: "FORBIDDEN" } };
  }

  try {
    const data = await handler();
    return { success: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
    // Surface the LocalizedError code so client forms can translate it
    const code = err instanceof LocalizedError ? err.code : "INTERNAL_ERROR";
    // Log the full error server-side so it appears in the terminal
    console.error("[withPermission] action failed:", err);
    return { success: false, error: { message, code } };
  }
}
