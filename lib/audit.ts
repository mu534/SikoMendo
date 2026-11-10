/**
 * lib/audit.ts
 *
 * Shared audit-log helper used by all Server Actions.
 *
 * Reads the client IP from the incoming request headers so every audit event
 * records where it came from. The IP is taken (in order of preference) from:
 *   1. x-forwarded-for  — set by reverse proxies / load balancers
 *   2. x-real-ip        — set by some proxies (e.g. Nginx)
 *   3. null             — when neither header is present (direct connection
 *                         to Node without a proxy, or unit-test context)
 *
 * IMPORTANT: All callers are Server Actions ("use server") so `headers()`
 * is always available. Never call this from client components.
 */
import "server-only";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";

async function getClientIp(): Promise<string | null> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    if (forwarded) {
      // x-forwarded-for can be a comma-separated list; the first entry is the
      // original client IP. Strip whitespace to be safe.
      return forwarded.split(",")[0].trim();
    }
    return h.get("x-real-ip") ?? null;
  } catch {
    // headers() throws outside a request context (e.g. during build).
    return null;
  }
}

/**
 * Creates one audit log entry, automatically capturing the client IP.
 *
 * @param action   Verb string — e.g. "CREATE", "UPDATE", "SUSPEND"
 * @param entity   Model name — e.g. "Employee", "User", "Cooperative"
 * @param entityId Primary key of the affected record
 * @param changes  Before/after snapshot or relevant metadata (serialisable)
 * @param userId   ID of the authenticated user performing the action
 */
export async function logAudit(
  action: string,
  entity: string,
  entityId: string,
  changes: unknown,
  userId?: string
): Promise<void> {
  const ipAddress = await getClientIp();
  await prisma.auditLog.create({
    data: {
      action,
      entity,
      entityId,
      changes: changes as object,
      userId,
      ipAddress,
    },
  });
}
