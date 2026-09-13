/**
 * scripts/dev-clean.ts
 *
 * Resets local dev state:
 *   - Deletes .next build cache
 *   - Drops and recreates the local dev database
 *   - Re-runs migrations and seed
 *
 * Usage:  npx tsx scripts/dev-clean.ts
 *
 * ⚠️  Destructive — only run in local dev. Will refuse to run in production.
 */

import { execSync, spawnSync } from "child_process";
import { rmSync, existsSync } from "fs";

if (process.env.NODE_ENV === "production") {
  console.error("❌ dev-clean must never be run in production.");
  process.exit(1);
}

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("❌ DATABASE_URL is not set in .env.local");
  process.exit(1);
}

// Guard: only allow local/development databases
if (!dbUrl.includes("localhost") && !dbUrl.includes("127.0.0.1")) {
  console.error("❌ DATABASE_URL does not point to localhost.");
  console.error("   dev-clean only works with local databases to prevent accidental data loss.");
  process.exit(1);
}

function run(label: string, cmd: string) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(cmd, { shell: true, stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`  ✗ failed (exit ${result.status ?? "?"})`);
    process.exit(1);
  }
  console.log("  ✓ done");
}

console.log("\n🧹 Cleaning local dev environment...\n");

// Delete .next cache
if (existsSync(".next")) {
  rmSync(".next", { recursive: true, force: true });
  console.log("✓ Deleted .next/");
}

// Reset database (drops all tables, re-applies migrations)
run("Resetting database", "npx prisma migrate reset --force");

// Seed
run("Seeding database", "npx prisma db seed");

console.log("\n✅ Clean dev environment ready. Run `npm run dev` to start.\n");
