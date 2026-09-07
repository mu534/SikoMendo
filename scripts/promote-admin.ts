/**
 * One-time script: promote the production admin account to ADMIN role.
 * Run after clean-demo-data.ts when the real admin account has EMPLOYEE role.
 *
 * Usage:
 *   npx tsx scripts/promote-admin.ts <username>
 *
 * Example:
 *   npx tsx scripts/promote-admin.ts mudasir
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import prisma from "../lib/prisma";

async function main() {
  const username = process.argv[2];
  if (!username) {
    console.error("Usage: npx tsx scripts/promote-admin.ts <username>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, name: true, role: true },
  });

  if (!user) {
    console.error(`User @${username} not found.`);
    process.exit(1);
  }

  if (user.role === "ADMIN") {
    console.log(`@${username} is already ADMIN. Nothing to do.`);
    return;
  }

  await prisma.user.update({
    where: { username },
    data: { role: "ADMIN", mustChangePassword: false },
  });

  await prisma.auditLog.create({
    data: {
      action: "UPDATE",
      entity: "User",
      entityId: user.id,
      changes: { roleFrom: user.role, roleTo: "ADMIN", reason: "Production admin bootstrap" },
      userId: user.id,
    },
  });

  console.log(`✅ @${username} (${user.name}) promoted to ADMIN.`);
}

main()
  .catch((e) => { console.error("❌", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
