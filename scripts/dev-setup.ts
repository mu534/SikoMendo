/**
 * scripts/dev-setup.ts
 *
 * One-command local dev setup:
 *   1. Copy .env.example → .env.local (if missing)
 *   2. Install dependencies
 *   3. Generate Prisma client
 *   4. Run migrations (dev mode)
 *   5. Run seed
 *
 * Usage:  npx tsx scripts/dev-setup.ts
 */

import { execSync } from "child_process";
import { existsSync, copyFileSync } from "fs";

function run(label: string, cmd: string) {
  console.log(`\n▶ ${label}`);
  try {
    execSync(cmd, { stdio: "inherit" });
    console.log(`  ✓ done`);
  } catch {
    console.error(`  ✗ failed`);
    process.exit(1);
  }
}

// 1. .env.local
if (!existsSync(".env.local")) {
  if (!existsSync(".env.example")) {
    console.error("❌ .env.example not found. Cannot create .env.local.");
    process.exit(1);
  }
  copyFileSync(".env.example", ".env.local");
  console.log("📄 Created .env.local from .env.example");
  console.log("   ⚠️  Fill in your real credentials before continuing.");
  process.exit(0); // stop here so developer can configure env first
} else {
  console.log("✓ .env.local already exists");
}

// 2. Dependencies
run("Installing dependencies", "npm install");

// 3. Prisma client
run("Generating Prisma client", "npx prisma generate");

// 4. Migrations
run("Running database migrations", "npx prisma migrate dev");

// 5. Seed
run("Seeding database", "npx prisma db seed");

console.log("\n✅ Dev setup complete. Run `npm run dev` to start the app.\n");
