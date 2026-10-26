/**
 * recover-admin.mjs
 * =================
 * Emergency administrator password reset for Siko Mendo Union HRMIS.
 *
 * Use this script when an administrator cannot log in and the normal
 * "Reset password" button inside the application is unreachable.
 *
 * USAGE
 * -----
 *   node scripts/recover-admin.mjs
 *
 * The script will:
 *   1. List every ADMIN-role account so you can confirm which one to reset.
 *   2. Ask which account to target (enter its username).
 *   3. Ask for the new temporary password (typed, not shown).
 *   4. Hash the password with the same scrypt configuration Better Auth uses.
 *   5. Write the hash to the `account` table.
 *   6. Clear `mustChangePassword` (set to false) so the admin is not forced
 *      through the password-change page after recovering.
 *   7. Delete all existing sessions for that account so stale cookies cannot
 *      be reused.
 *
 * The new password is NEVER written to a log, file, or the database in
 * plaintext.  Only the bcrypt-equivalent scrypt hash is stored.
 *
 * REQUIREMENTS
 * ------------
 *   - Node.js ≥ 18 (uses node:crypto, node:readline/promises, node:util)
 *   - The `pg` package (already installed as a project dependency)
 *   - DATABASE_URL environment variable set, OR the script falls back to the
 *     hardcoded development connection string below.
 *
 * To run from the project root:
 *
 *   node scripts/recover-admin.mjs
 *
 * On Windows with PowerShell, invoke with the explicit Node path if the
 * shell strips arguments:
 *
 *   & "C:\Program Files\nodejs\node.exe" scripts/recover-admin.mjs
 *
 * SECURITY NOTES
 * --------------
 *   - Run this only on a trusted machine with direct database access.
 *   - Delete or rotate the database password after an emergency recovery.
 *   - The script does NOT bypass the application's authorization layer —
 *     it only resets the stored password hash and kills active sessions.
 *   - Audit the recovery in the application's audit log after regaining
 *     access: go to /audit-log and verify the PASSWORD_RESET entry.
 */

import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { createInterface } from "node:readline/promises";
import pg from "pg";

// ── Better Auth scrypt parameters (must match @better-auth/utils/dist/password.node.mjs) ──
const SCRYPT_N    = 16384;
const SCRYPT_R    = 16;
const SCRYPT_P    = 1;
const SCRYPT_DKLEN = 64;

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key  = await scryptAsync(
    password.normalize("NFKC"),
    salt,
    SCRYPT_DKLEN,
    { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: 128 * SCRYPT_N * SCRYPT_R * 2 }
  );
  return `${salt}:${key.toString("hex")}`;
}

/** Read a line from stdin, optionally masking input (best-effort on terminals). */
async function prompt(rl, question, { masked = false } = {}) {
  if (!masked) return (await rl.question(question)).trim();

  // Mask input: write the question, suppress echo while reading.
  process.stdout.write(question);
  const tty = process.stdin.isTTY;
  if (tty) process.stdin.setRawMode(true);

  let input = "";
  process.stdout.write("\x1b[?25l"); // hide cursor

  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  await new Promise((resolve) => {
    function onData(ch) {
      if (ch === "\r" || ch === "\n") {
        process.stdin.off("data", onData);
        process.stdin.pause();
        resolve(undefined);
        return;
      }
      if (ch === "\x03") { process.stdout.write("\n"); process.exit(1); } // Ctrl-C
      if (ch === "\x7f" || ch === "\b") { // backspace
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stdout.write("\b \b");
        }
        return;
      }
      input += ch;
      process.stdout.write("*");
    }
    process.stdin.on("data", onData);
  });

  if (tty) process.stdin.setRawMode(false);
  process.stdout.write("\x1b[?25h\n"); // show cursor + newline
  return input;
}

// ── Main ─────────────────────────────────────────────────────────────────────

const DB_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:mudasir@127.0.0.1:5432/siko_mendo_hris";

const client = new pg.Client({ connectionString: DB_URL });
const rl     = createInterface({ input: process.stdin, output: process.stdout });

try {
  await client.connect();

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Siko Mendo HRMIS — Admin Password Recovery");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // 1. List ADMIN accounts
  const { rows: admins } = await client.query(
    `SELECT id, name, username, banned, "mustChangePassword"
       FROM "user"
      WHERE role = 'ADMIN'
      ORDER BY "createdAt" ASC`
  );

  if (admins.length === 0) {
    console.error("No ADMIN accounts found in the database.");
    process.exit(1);
  }

  console.log("ADMIN accounts:\n");
  for (const a of admins) {
    const flags = [
      a.banned            ? "SUSPENDED"            : "active",
      a.mustChangePassword ? "must-change-password" : null,
    ].filter(Boolean).join(", ");
    console.log(`  ${a.username.padEnd(20)} ${a.name.padEnd(30)} [${flags}]`);
  }
  console.log();

  // 2. Choose target
  const targetUsername = await prompt(rl, "Enter the username to reset: ");
  const target = admins.find((a) => a.username === targetUsername);
  if (!target) {
    console.error(`\nNo ADMIN account with username "${targetUsername}".`);
    process.exit(1);
  }

  // 3. New password
  const newPass = await prompt(
    rl,
    `New temporary password for ${target.name}: `,
    { masked: true }
  );
  if (newPass.length < 8) {
    console.error("\nPassword must be at least 8 characters.");
    process.exit(1);
  }
  const confirm = await prompt(rl, "Confirm password: ", { masked: true });
  if (newPass !== confirm) {
    console.error("\nPasswords do not match.");
    process.exit(1);
  }

  // 4. Hash and write
  process.stdout.write("\nHashing password…  ");
  const hash = await hashPassword(newPass);
  process.stdout.write("done.\n");

  const { rowCount: accountRows } = await client.query(
    `UPDATE account SET password = $1
      WHERE "userId" = $2 AND "providerId" = 'credential'`,
    [hash, target.id]
  );
  if (accountRows === 0) {
    console.warn(
      "Warning: no credential-provider account row found. " +
      "The user may have been created without a password account."
    );
  }

  // 5. Clear mustChangePassword so admin goes straight to dashboard
  await client.query(
    `UPDATE "user" SET "mustChangePassword" = false WHERE id = $1`,
    [target.id]
  );

  // 6. Kill all sessions
  const { rowCount: sessionRows } = await client.query(
    `DELETE FROM session WHERE "userId" = $1`,
    [target.id]
  );

  console.log(`\n✓  Password reset for: ${target.name} (${target.username})`);
  console.log(`   Sessions invalidated: ${sessionRows ?? 0}`);
  console.log(`   mustChangePassword:   cleared\n`);
  console.log("Sign in at /sign-in with the username and the new password.");
  console.log(
    "After regaining access, go to /audit-log and add a manual note\n" +
    "recording this emergency recovery.\n"
  );
} catch (err) {
  console.error("\nFailed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
} finally {
  rl.close();
  await client.end();
}
