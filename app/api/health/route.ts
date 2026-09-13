import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/health
 *
 * Returns the current health status of the application and its dependencies.
 * Used by uptime monitors, load balancers, and the pre-deploy check script.
 *
 * Response shape:
 *   { status: "ok" | "degraded" | "down", checks: { ... }, timestamp: string }
 *
 * HTTP 200 = ok or degraded (app is running but a dependency has issues)
 * HTTP 503 = down (critical dependency unavailable)
 */
export async function GET() {
  const checks: Record<string, { ok: boolean; message?: string; latencyMs?: number }> = {};

  // ── Database ──────────────────────────────────────────────────────────────
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { ok: true, latencyMs: Date.now() - dbStart };
  } catch (err) {
    checks.database = {
      ok: false,
      latencyMs: Date.now() - dbStart,
      message: err instanceof Error ? err.message : "Unknown database error",
    };
  }

  // ── Migration status ──────────────────────────────────────────────────────
  try {
    // Check that the _prisma_migrations table exists and has at least one
    // completed migration — a sign that migrate deploy has been run.
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count
      FROM _prisma_migrations
      WHERE finished_at IS NOT NULL
    `;
    const count = Number(rows[0]?.count ?? 0);
    checks.migrations = {
      ok: count > 0,
      message: count > 0 ? `${count} migration(s) applied` : "No migrations found — run prisma migrate deploy",
    };
  } catch {
    checks.migrations = { ok: false, message: "Could not query migration table" };
  }

  // ── Overall status ────────────────────────────────────────────────────────
  const allOk      = Object.values(checks).every((c) => c.ok);
  const anyFailing = Object.values(checks).some((c) => !c.ok);
  const status     = allOk ? "ok" : anyFailing && !checks.database?.ok ? "down" : "degraded";

  return NextResponse.json(
    { status, checks, timestamp: new Date().toISOString() },
    { status: status === "down" ? 503 : 200 }
  );
}
