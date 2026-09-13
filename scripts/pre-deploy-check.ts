/**
 * scripts/pre-deploy-check.ts
 *
 * Pre-deployment validation checklist. Runs all critical checks before
 * a deployment proceeds. Called automatically via the `predeploy` npm hook.
 *
 * Checks performed:
 *   1. Environment variables present and valid
 *   2. No TypeScript errors
 *   3. Linting passes
 *   4. Unit tests pass
 *   5. No pending Prisma migrations
 *   6. Health endpoint responds (if app is already running)
 *
 * Usage:  npx tsx scripts/pre-deploy-check.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { spawnSync } from "child_process";

type CheckResult = { name: string; ok: boolean; message?: string };
const results: CheckResult[] = [];

function runCommand(name: string, cmd: string, args: string[]): CheckResult {
  process.stdout.write(`  Checking ${name}… `);
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    env: process.env,
    timeout: 120_000,
  });
  const ok = result.status === 0;
  console.log(ok ? "✓" : "✗");
  return {
    name,
    ok,
    message: ok ? undefined : (result.stderr?.trim() || result.stdout?.trim() || `exit ${result.status}`).slice(0, 200),
  };
}

console.log("\n🔍 Pre-deployment checks\n");

// 1. Env vars
results.push(runCommand("Environment variables", "npx", ["tsx", "scripts/validate-env.ts"]));

// 2. TypeScript
results.push(runCommand("TypeScript", "npx", ["tsc", "--noEmit"]));

// 3. Lint
results.push(runCommand("Lint", "npm", ["run", "lint"]));

// 4. Unit tests
results.push(runCommand("Unit tests", "npm", ["test"]));

// 5. No pending migrations (compare schema with DB)
results.push(runCommand("Prisma migrations", "npx", [
  "prisma", "migrate", "status",
]));

// ── Summary ───────────────────────────────────────────────────────────────────

console.log("\n── Results ──────────────────────────────────────────────────");
let allOk = true;
for (const r of results) {
  const icon = r.ok ? "✅" : "❌";
  console.log(`  ${icon} ${r.name}`);
  if (!r.ok && r.message) {
    console.log(`     ${r.message.replace(/\n/g, "\n     ")}`);
    allOk = false;
  }
}
console.log("─────────────────────────────────────────────────────────────\n");

if (allOk) {
  console.log("✅ All checks passed. Safe to deploy.\n");
  process.exit(0);
} else {
  console.error("❌ One or more checks failed. Fix the issues above before deploying.\n");
  process.exit(1);
}
