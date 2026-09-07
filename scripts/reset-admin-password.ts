/**
 * Reset the password for any user by username using Better Auth's own
 * password hashing — avoids the "Invalid password hash" error.
 *
 * Usage:
 *   npx tsx scripts/reset-admin-password.ts <username>
 *
 * Example:
 *   npx tsx scripts/reset-admin-password.ts mudasir
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { Pool } from "pg";
import crypto from "node:crypto";

// ── Password generation (no server-only imports) ──────────────────────────────
const LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
const DIGITS  = "23456789";
const SYMBOLS = "!@#$%";
const ALL     = LETTERS + DIGITS;

function randomChar(charset: string): string {
  return charset[crypto.randomBytes(1)[0] % charset.length];
}

function generatePassword(): string {
  const required = [randomChar(LETTERS), randomChar(DIGITS), randomChar(SYMBOLS)];
  const rest = Array.from({ length: 8 }, () => randomChar(ALL));
  const chars = [...required, ...rest];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomBytes(1)[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

async function main() {
  const username = process.argv[2];
  if (!username) {
    console.error("Usage: npx tsx scripts/reset-admin-password.ts <username>");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    // Look up the user
    const userRes = await client.query(
      `SELECT id, name, role FROM "user" WHERE username = $1 LIMIT 1`,
      [username]
    );

    if (!userRes.rows.length) {
      console.error(`\n❌ No user found with username @${username}\n`);
      process.exit(1);
    }

    const user = userRes.rows[0] as { id: string; name: string; role: string };

    // Check account exists
    const accRes = await client.query(
      `SELECT id FROM account WHERE "userId" = $1 AND "providerId" = 'credential' LIMIT 1`,
      [user.id]
    );

    if (!accRes.rows.length) {
      console.error(`\n❌ No credential account found for @${username}\n`);
      process.exit(1);
    }

    const newPassword = generatePassword();

    // Use Better Auth's own hashPassword — produces the exact format Better Auth expects
    const { hashPassword } = await import("@better-auth/utils/password");
    const passwordHash = await hashPassword(newPassword);

    // Write the hash directly to the account table
    await client.query(
      `UPDATE account SET password = $1 WHERE "userId" = $2 AND "providerId" = 'credential'`,
      [passwordHash, user.id]
    );

    // Force password change on next sign-in
    await client.query(
      `UPDATE "user" SET "mustChangePassword" = true WHERE id = $1`,
      [user.id]
    );

    // Audit log
    await client.query(
      `INSERT INTO audit_log (id, action, entity, "entityId", changes, "userId", "createdAt")
       VALUES (gen_random_uuid()::text, 'PASSWORD_RESET', 'User', $1, $2::jsonb, $1, NOW())`,
      [user.id, JSON.stringify({ reason: "Bootstrap reset via CLI script" })]
    );

    console.log(`\n✅ Password reset for @${username}`);
    console.log(`   Name : ${user.name}`);
    console.log(`   Role : ${user.role}`);
    console.log(`\n   ┌───────────────────────────────────────────┐`);
    console.log(`   │  Temporary password: ${newPassword.padEnd(20)} │`);
    console.log(`   └───────────────────────────────────────────┘`);
    console.log(`\n   Sign in at http://localhost:3000/sign-in`);
    console.log(`   Username: ${username}`);
    console.log(`   You will be prompted to set a new password after signing in.\n`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
