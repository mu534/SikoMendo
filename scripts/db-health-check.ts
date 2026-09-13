/**
 * scripts/db-health-check.ts
 *
 * Verifies Postgres connectivity, checks migration status, and validates that
 * key tables exist. Exits 0 on success, 1 on failure.
 *
 * Usage:  npx tsx scripts/db-health-check.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { Pool } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("❌ DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 5000 });

async function check(label: string, fn: () => Promise<string>) {
  try {
    const result = await fn();
    console.log(`  ✓ ${label}: ${result}`);
    return true;
  } catch (err) {
    console.error(`  ✗ ${label}: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

async function main() {
  console.log("\n🔍 Database health check\n");

  let ok = true;

  ok &&= await check("Connectivity", async () => {
    const { rows } = await pool.query("SELECT version()");
    const version: string = rows[0]?.version ?? "unknown";
    return version.split(" ").slice(0, 2).join(" "); // e.g. "PostgreSQL 16.3"
  });

  ok &&= await check("Migrations", async () => {
    const { rows } = await pool.query<{ count: string }>(
      "SELECT COUNT(*) AS count FROM _prisma_migrations WHERE finished_at IS NOT NULL"
    );
    const count = parseInt(rows[0]?.count ?? "0", 10);
    if (count === 0) throw new Error("No completed migrations found — run prisma migrate deploy");
    return `${count} migration(s) applied`;
  });

  ok &&= await check("Pending migrations", async () => {
    const { rows } = await pool.query<{ count: string }>(
      "SELECT COUNT(*) AS count FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL"
    );
    const count = parseInt(rows[0]?.count ?? "0", 10);
    if (count > 0) throw new Error(`${count} migration(s) not yet applied — run prisma migrate deploy`);
    return "none pending";
  });

  // Spot-check that key domain tables exist
  const tables = ["employee", "department", "attendance", "leave_request", "audit_log"];
  for (const table of tables) {
    ok &&= await check(`Table: ${table}`, async () => {
      const { rows } = await pool.query<{ count: string }>(
        "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema='public' AND table_name=$1",
        [table]
      );
      const count = parseInt(rows[0]?.count ?? "0", 10);
      if (count === 0) throw new Error("table not found");
      return "exists";
    });
  }

  await pool.end();

  if (ok) {
    console.log("\n✅ Database is healthy.\n");
    process.exit(0);
  } else {
    console.error("\n❌ Database health check failed.\n");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
