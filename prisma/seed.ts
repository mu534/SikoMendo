import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import prisma from "../lib/prisma";
import bcrypt from "bcryptjs";

// ── Admin account ─────────────────────────────────────────────────────────────
// This account is ALWAYS seeded and is never removed by a database reset.
// Change these values before the first deploy; after that use the UI to
// update the password.

const ADMIN = {
  username: "admin",
  name:     "System Administrator",
  email:    "admin@sikomendo.local",
  password: "Admin@1234",   // temporary — must be changed on first login
  role:     "ADMIN" as const,
};

// ── Org structure ─────────────────────────────────────────────────────────────
// Departments and positions are fixed by the union's constitution.

const ORG_STRUCTURE: {
  name: string;
  description: string;
  positions: string[];
}[] = [
  {
    name: "Finance Department",
    description: "Union-wide financial management and accounting.",
    positions: [
      "Finance Manager",
      "Senior Accountant",
      "Accountant",
      "Cashier",
      "Finance Officer",
      "Internal Auditor",
    ],
  },
  {
    name: "Human Resource Department",
    description: "Employee records, recruitment, and HR policy.",
    positions: [
      "HR Manager",
      "HR Officer",
      "Recruitment Officer",
      "Training and Development Officer",
      "HR Assistant",
    ],
  },
  {
    name: "Marketing Department",
    description: "Product marketing and member outreach.",
    positions: [
      "Marketing Manager",
      "Marketing Officer",
      "Business Development Officer",
      "Customer Relations Officer",
      "Market Research Officer",
    ],
  },
  {
    name: "Input Supply Department",
    description: "Agricultural input procurement and distribution.",
    positions: [
      "Input Supply Manager",
      "Procurement Officer",
      "Store Keeper",
      "Inventory Officer",
      "Logistics Officer",
      "Distribution Officer",
    ],
  },
  {
    name: "Legal Affairs Department",
    description: "Legal compliance and contract review.",
    positions: [
      "Legal Affairs Manager",
      "Legal Officer",
      "Compliance Officer",
      "Contract Administration Officer",
    ],
  },
  {
    name: "Mechanization Department",
    description: "Farm machinery services and maintenance.",
    positions: [
      "Mechanization Manager",
      "Agricultural Machinery Officer",
      "Maintenance Technician",
      "Workshop Supervisor",
      "Field Mechanization Officer",
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function cuid(): string {
  // Simple timestamp-based ID that matches the cuid-like format Better Auth uses.
  // Good enough for seed-time; Better Auth will manage its own IDs in production.
  return (
    "c" +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Running seed (idempotent)...\n");

  // ── 1. Admin account ────────────────────────────────────────────────────────
  // Uses upsert on `username` so re-running the seed never creates a duplicate.
  // The password is only written when the account is first created; subsequent
  // runs leave the existing (possibly changed) password untouched.

  const existingUser = await prisma.user.findFirst({
    where: { username: ADMIN.username },
    select: { id: true },
  });

  if (existingUser) {
    // Make sure the role is still ADMIN in case it was accidentally changed.
    await prisma.user.update({
      where: { id: existingUser.id },
      data: { role: ADMIN.role },
    });
    console.log(`  ✓ Admin account "${ADMIN.username}" already exists — skipped.`);
  } else {
    const passwordHash = await bcrypt.hash(ADMIN.password, 10);
    const userId = cuid();

    await prisma.user.create({
      data: {
        id:            userId,
        username:      ADMIN.username,
        displayUsername: ADMIN.username,
        name:          ADMIN.name,
        email:         ADMIN.email,
        emailVerified: true,
        role:          ADMIN.role,
        mustChangePassword: true,   // force password change on first login
        accounts: {
          create: {
            id:         cuid(),
            accountId:  userId,
            providerId: "credential",
            password:   passwordHash,
          },
        },
      },
    });

    console.log(`  ✓ Admin account created.`);
    console.log(`    Username : ${ADMIN.username}`);
    console.log(`    Password : ${ADMIN.password}  ← change on first login`);
  }

  console.log();

  // ── 2. Org structure ────────────────────────────────────────────────────────
  for (const dept of ORG_STRUCTURE) {
    const department = await prisma.department.upsert({
      where:  { name: dept.name },
      create: { name: dept.name, description: dept.description },
      update: { description: dept.description },
    });

    for (const positionName of dept.positions) {
      await prisma.position.upsert({
        where:  { departmentId_name: { departmentId: department.id, name: positionName } },
        create: { name: positionName, departmentId: department.id },
        update: {},
      });
    }

    console.log(`  ✓ ${dept.name} (${dept.positions.length} positions)`);
  }

  console.log("\n✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
