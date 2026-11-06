/**
 * features/backups/pg-tools.ts
 *
 * Safe wrappers around pg_dump and pg_restore using child_process.
 * All command arguments are passed as separate array elements — never
 * string-interpolated — to prevent command injection.
 *
 * Temp files are created in os.tmpdir() and cleaned up in `finally` blocks.
 */
import "server-only";
import { execFile } from "child_process";
import { promisify } from "util";
import { readFile, writeFile, unlink, mkdtemp } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { env } from "@/lib/env";

const execFileAsync = promisify(execFile);

const DUMP_TIMEOUT_MS  = 5 * 60 * 1000;  // 5 minutes
const RESTORE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export interface PgDumpResult {
  dumpBuffer: Buffer;
  tmpPath: string; // caller must delete in finally
}

export interface PgRestoreListEntry {
  id: string;
  type: string;
  name: string;
}

/**
 * Strips Prisma-specific query parameters (e.g. ?schema=public) from a
 * PostgreSQL connection URL before passing it to pg_dump / pg_restore.
 * pg_dump rejects unrecognised URI query parameters.
 */
function pgConnectionUrl(databaseUrl: string): string {
  try {
    const u = new URL(databaseUrl);
    // Remove params pg_dump doesn't understand
    u.searchParams.delete("schema");
    u.searchParams.delete("pgbouncer");
    u.searchParams.delete("connection_limit");
    u.searchParams.delete("pool_timeout");
    // If no params remain, remove the trailing '?'
    return u.toString();
  } catch {
    // Not a valid URL — return as-is and let pg_dump report the real error
    return databaseUrl;
  }
}

/**
 * Runs pg_dump --format=custom against DATABASE_URL and returns a Buffer.
 * Temp file is created in os.tmpdir(); callers MUST delete it in a finally block.
 *
 * Command construction uses execFile array form — injection-safe.
 */
export async function runPgDump(): Promise<PgDumpResult> {
  const pgDumpPath = env.PG_DUMP_PATH ?? "pg_dump";
  const databaseUrl = pgConnectionUrl(env.DATABASE_URL);

  const tmpDir  = await mkdtemp(join(tmpdir(), "siko-mendo-backup-"));
  const tmpPath = join(tmpDir, "dump.pgcustom");

  try {
    await execFileAsync(
      pgDumpPath,
      [
        databaseUrl,
        "--format=custom",
        "--no-owner",
        "--no-privileges",
        `--file=${tmpPath}`,
      ],
      { timeout: DUMP_TIMEOUT_MS }
    );

    const dumpBuffer = await readFile(tmpPath);
    return { dumpBuffer, tmpPath };
  } catch (err) {
    // Clean up on failure
    await unlink(tmpPath).catch(() => {});
    throw err;
  }
}

/**
 * Runs pg_restore --list against a dump file and returns parsed TOC entries.
 * Non-destructive (read-only on the dump file).
 */
export async function pgRestoreList(dumpPath: string): Promise<PgRestoreListEntry[]> {
  const pgRestorePath = env.PG_RESTORE_PATH ?? "pg_restore";

  const { stdout } = await execFileAsync(
    pgRestorePath,
    ["--list", dumpPath],
    { timeout: 30_000 }
  );

  const entries: PgRestoreListEntry[] = [];
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(";")) continue;
    // TOC line format: "<id>; <oid> <oid> <type> ... <name>"
    const match = trimmed.match(/^(\d+);.+?(\w+)\s+(\S+)/);
    if (match) {
      entries.push({ id: match[1], type: match[2], name: match[3] });
    }
  }
  return entries;
}

/**
 * Writes a dump buffer to a temp file, runs pg_restore, then cleans up.
 * Uses --single-transaction so a failure rolls back automatically.
 *
 * @param dumpBuffer  Buffer from decryptBackup().dumpBuffer
 * @returns void on success; throws on failure
 */
export async function runPgRestore(dumpBuffer: Buffer): Promise<void> {
  const pgRestorePath = env.PG_RESTORE_PATH ?? "pg_restore";
  const databaseUrl   = pgConnectionUrl(env.DATABASE_URL);

  const tmpDir  = await mkdtemp(join(tmpdir(), "siko-mendo-restore-"));
  const tmpPath = join(tmpDir, "restore.pgcustom");

  try {
    await writeFile(tmpPath, dumpBuffer);

    await execFileAsync(
      pgRestorePath,
      [
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-privileges",
        "--exit-on-error",
        "--single-transaction",
        `--dbname=${databaseUrl}`,
        tmpPath,
      ],
      { timeout: RESTORE_TIMEOUT_MS }
    );
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}

/**
 * Deletes a temp file. Safe to call in a finally block — silently ignores errors.
 */
export async function deleteTempFile(path: string): Promise<void> {
  await unlink(path).catch(() => {});
}
