import { can, type Action } from "./permissions";

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string; code?: string } };

export type AppUser = { id: string; role?: string; email?: string } & Record<string, unknown>;
export type AppSession = { user?: AppUser } | null;

export async function withPermission<T>(
  session: AppSession | null,
  action: Action,
  handler: () => Promise<T>
): Promise<ActionResult<T>> {
  if (!session || !session.user) {
    return { success: false, error: { message: "Unauthorized", code: "UNAUTHORIZED" } };
  }
  const role = session.user.role;
  if (!can(role, action)) {
    return { success: false, error: { message: "Forbidden", code: "FORBIDDEN" } };
  }

  try {
    const data = await handler();
    return { success: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: { message, code: "INTERNAL_ERROR" } };
  }
}
