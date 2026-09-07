

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import prisma from "../lib/prisma";

// ── Org structure ─────────────────────────────────────────────────────────────
// Departments and positions are fixed by the union's constitution.
// They are the only records this seed is responsible for.

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

async function main() {
  console.log("🌱 Running production seed (idempotent)...");

  for (const dept of ORG_STRUCTURE) {
    // Upsert department — creates if missing, updates description if changed.
    const department = await prisma.department.upsert({
      where: { name: dept.name },
      create: { name: dept.name, description: dept.description },
      update: { description: dept.description },
    });

    for (const positionName of dept.positions) {
      // Upsert position — no change if it already exists with this name in this dept.
      await prisma.position.upsert({
        where: { departmentId_name: { departmentId: department.id, name: positionName } },
        create: { name: positionName, departmentId: department.id },
        update: {},
      });
    }

    console.log(`  ✓ ${dept.name} (${dept.positions.length} positions)`);
  }

  console.log("\n✅ Seed completed. Existing data was not modified.");
  console.log(
    "   To add the first admin account, sign up via the app or run:\n" +
    "   npx tsx scripts/promote-admin.ts <username>"
  );
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
