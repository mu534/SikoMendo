/**
 * Siko Mendo HRMIS — Database Restore Script
 *
 * Usage:
 *   npx tsx scripts/restore-backup.ts <path-to-backup.json>
 *
 * Example:
 *   npx tsx scripts/restore-backup.ts siko-mendo-backup-2026-09-05.json
 *
 * ⚠  WARNING — READ BEFORE RUNNING ⚠
 * ─────────────────────────────────────────────────────────────────────────────
 * This script PERMANENTLY REPLACES all data in the target database with the
 * contents of the backup file.
 *
 * Before running:
 *   1. Stop the application server (npm run dev / the production process).
 *   2. Take a NEW backup of the current database if you need a safety copy.
 *   3. Confirm you are running against the correct DATABASE_URL.
 *   4. Type "YES" at the confirmation prompt to proceed.
 *
 * After running:
 *   1. Verify the data looks correct in the database.
 *   2. Restart the application server.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import dotenv from "dotenv";
import { Pool } from "pg";

// Load .env.local then .env so DATABASE_URL is available
dotenv.config({ path: ".env.local" });
dotenv.config();

// ── Table restore order (respects FK dependencies) ───────────────────────────
// Each table is truncated and re-inserted in this order.
// Tables referencing others come AFTER their dependencies.
const RESTORE_ORDER = [
  // Auth / User (no FK deps within our schema)
  "user",
  "session",
  "account",
  "verification",
  // Org structure
  "department",
  "position",
  // HR records
  "employee",
  "employment_history",
  "contract",
  // Cooperatives (no FK to employees)
  "cooperative",
  // Transactional records
  "attendance",
  "document",
  "leave_request",
  "leave_entitlement",
  // System
  "report",
  "audit_log",
  "org_settings",
  "backup_log",
  "notification",
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Builds a parameterised INSERT statement for a batch of rows.
 * Returns null if the batch is empty.
 */
function buildInsert(
  table: string,
  rows: Record<string, unknown>[]
): { text: string; values: unknown[] } | null {
  if (!rows.length) return null;

  const columns = Object.keys(rows[0]);
  if (!columns.length) return null;

  const values: unknown[] = [];
  const rowPlaceholders: string[] = [];
  let paramIdx = 1;

  for (const row of rows) {
    const placeholders = columns.map(() => `$${paramIdx++}`);
    rowPlaceholders.push(`(${placeholders.join(", ")})`);
    for (const col of columns) {
      values.push(row[col] ?? null);
    }
  }

  const colList = columns.map((c) => `"${c}"`).join(", ");
  const text = `INSERT INTO "${table}" (${colList}) VALUES ${rowPlaceholders.join(", ")} ON CONFLICT DO NOTHING`;

  return { text, values };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error("Usage: npx tsx scripts/restore-backup.ts <backup.json>");
    process.exit(1);
  }

  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`File not found: ${resolved}`);
    process.exit(1);
  }

  // ── Parse backup file ─────────────────────────────────────────────────────
  console.log(`\nReading backup: ${resolved}`);
  const raw = fs.readFileSync(resolved, "utf-8");
  const fileSizeBytes = Buffer.byteLength(raw, "utf-8");

  let backup: {
    version: number;
    createdAt: string;
    tables: Record<string, Record<string, unknown>[]>;
  };

  try {
    backup = JSON.parse(raw);
  } catch {
    console.error("Failed to parse backup file. Make sure it is a valid JSON file.");
    process.exit(1);
  }

  if (backup.version !== 1) {
    console.error(`Unsupported backup version: ${backup.version}`);
    process.exit(1);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const dbUrl = process.env.DATABASE_URL ?? "(not set)";
  const dbDisplay = dbUrl.replace(/:\/\/[^@]+@/, "://<credentials>@"); // hide password

  console.log("\n─────────────────────────────────────────────────────────");
  console.log("  Siko Mendo HRMIS — Database Restore");
  console.log("─────────────────────────────────────────────────────────");
  console.log(`  Backup created : ${new Date(backup.createdAt).toLocaleString()}`);
  console.log(`  File size      : ${formatSize(fileSizeBytes)}`);
  console.log(`  Target DB      : ${dbDisplay}`);
  console.log("");

  const tableSummary = RESTORE_ORDER.map((t) => {
    const rows = backup.tables[t];
    const count = Array.isArray(rows) ? rows.length : 0;
    return `    ${t.padEnd(24)} ${count.toLocaleString()} rows`;
  });
  console.log("  Tables to restore:");
  console.log(tableSummary.join("\n"));
  console.log("─────────────────────────────────────────────────────────");
  console.log("");
  console.log("  ⚠  This will TRUNCATE and REPLACE all data above.");
  console.log("  ⚠  Make sure the application server is STOPPED.");
  console.log("");

  // ── Confirmation ──────────────────────────────────────────────────────────
  const rl = readline.createInterface({ input, output });
  const answer = await rl.question('  Type "YES" to proceed, anything else to cancel: ');
  rl.close();

  if (answer.trim() !== "YES") {
    console.log("\nRestore cancelled. No changes were made.");
    process.exit(0);
  }

  // ── Connect ───────────────────────────────────────────────────────────────
  if (!process.env.DATABASE_URL) {
    console.error("\nDATABASE_URL is not set. Make sure .env.local exists.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  console.log("\nStarting restore…");

  try {
    // Wrap everything in a single transaction so a failure rolls back cleanly
    await client.query("BEGIN");

    // Disable FK checks temporarily so we can truncate in any order
    await client.query("SET session_replication_role = replica");

    // ── Truncate all tables ───────────────────────────────────────────────
    console.log("\nTruncating tables…");
    for (const table of [...RESTORE_ORDER].reverse()) {
      try {
        await client.query(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);
        process.stdout.write(`  ✓ truncated ${table}\n`);
      } catch {
        // Table may not exist in the target DB — skip
        process.stdout.write(`  - skipped  ${table} (table not found)\n`);
      }
    }

    // ── Insert rows ───────────────────────────────────────────────────────
    console.log("\nInserting rows…");
    for (const table of RESTORE_ORDER) {
      const rows = backup.tables[table];
      if (!Array.isArray(rows) || rows.length === 0) {
        process.stdout.write(`  - skipped  ${table} (no rows in backup)\n`);
        continue;
      }

      // Insert in batches of 500 to avoid huge queries
      const BATCH = 500;
      let inserted = 0;
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const stmt = buildInsert(table, batch);
        if (stmt) {
          await client.query(stmt.text, stmt.values);
          inserted += batch.length;
        }
      }
      process.stdout.write(`  ✓ restored ${table.padEnd(24)} ${inserted.toLocaleString()} rows\n`);
    }

    // Re-enable FK checks
    await client.query("SET session_replication_role = DEFAULT");

    await client.query("COMMIT");

    console.log("\n─────────────────────────────────────────────────────────");
    console.log("  ✓ Restore completed successfully.");
    console.log("  You can now restart the application server.");
    console.log("─────────────────────────────────────────────────────────\n");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("\n✗ Restore failed — all changes have been rolled back.");
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
