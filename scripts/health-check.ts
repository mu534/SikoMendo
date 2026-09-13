/**
 * scripts/health-check.ts
 *
 * Calls the app's /api/health endpoint and reports status.
 * Exits 0 if healthy or degraded, 1 if down or unreachable.
 *
 * Usage:  npx tsx scripts/health-check.ts [BASE_URL]
 *
 * Examples:
 *   npx tsx scripts/health-check.ts
 *   npx tsx scripts/health-check.ts https://hris.sikomendo.org
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const baseUrl =
  process.argv[2] ||
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.BETTER_AUTH_URL ||
  "http://localhost:3000";

const endpoint = `${baseUrl.replace(/\/$/, "")}/api/health`;

async function main() {
  console.log(`\n🔍 Checking health at ${endpoint}\n`);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    console.error(`❌ Could not reach ${endpoint}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  let body: Record<string, unknown>;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    console.error(`❌ Non-JSON response (HTTP ${response.status})`);
    process.exit(1);
  }

  const status  = body.status as string;
  const checks  = body.checks as Record<string, { ok: boolean; message?: string; latencyMs?: number }>;

  if (status === "ok") {
    console.log(`✅ Status: ${status.toUpperCase()}`);
  } else if (status === "degraded") {
    console.warn(`⚠️  Status: ${status.toUpperCase()}`);
  } else {
    console.error(`❌ Status: ${status?.toUpperCase() ?? "UNKNOWN"} (HTTP ${response.status})`);
  }

  if (checks) {
    for (const [name, detail] of Object.entries(checks)) {
      const icon  = detail.ok ? "  ✓" : "  ✗";
      const lat   = detail.latencyMs !== undefined ? ` (${detail.latencyMs}ms)` : "";
      const msg   = detail.message ? ` — ${detail.message}` : "";
      console.log(`${icon} ${name}${lat}${msg}`);
    }
  }

  console.log(`\n  Timestamp: ${body.timestamp}`);
  console.log();

  process.exit(status === "down" || response.status >= 500 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
