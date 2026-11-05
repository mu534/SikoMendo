/**
 * role-correction.ts
 *
 * DO NOT run with --apply without manual review.
 *
 * Identifies User records with incorrect role assignments:
 *   - Role = "MANAGER"  whose linked employee is not the sole General Manager
 *   - Role = "HR_OFFICER" whose linked employee is not in the HR department
 *
 * In dry-run mode (default): prints a report table and exits.
 * With --apply: corrects the roles and writes an AuditLog entry per correction.
 *
 * Usage:
 *   npx tsx .agents/tasks/dept-manager-fix/role-correction.ts
 *   npx tsx .agents/tasks/dept-manager-fix/role-correction.ts --apply
 */

import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";

// Resolve to the workspace root so `@/lib/prisma` resolves correctly when run
// from the .agents subdirectory.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.chdir(path.resolve(__dirname, "../../.."));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { default: prisma } = await import("../../lib/prisma.js").catch(
  () => import("../../../lib/prisma.js")
) as { default: import("@prisma/client").PrismaClient };

const APPLY = process.argv.includes("--apply");
const HR_DEPARTMENT_NAME = "Human Resource Department";

async function main() {
  console.log(`\n── Department-Manager Role Correction Script ─────────────────────`);
  console.log(`Mode: ${APPLY ? "APPLY (DB writes enabled)" : "DRY RUN (no DB writes)"}\n`);

  // ── 1. Find all active MANAGER users ─────────────────────────────────────
  const managerUsers = await prisma.user.findMany({
    where: { role: "MANAGER", deletedAt: null },
    select: {
      id: true,
      name: true,
      username: true,
      employee: {
        select: {
          id: true,
          employeeId: true,
          departmentId: true,
          department: { select: { name: true } },
        },
      },
    },
  });

  // There should be at most one MANAGER — the General Manager.
  // Any extras are incorrect.
  const incorrectManagers = managerUsers.length > 1 ? managerUsers.slice(1) : [];
  if (managerUsers.length > 1) {
    console.warn(
      `WARNING: ${managerUsers.length} users have role=MANAGER. ` +
      `Only the first is assumed to be the correct General Manager; the rest are flagged.`
    );
  }

  // ── 2. Find all active HR_OFFICER users ──────────────────────────────────
  const hrOfficerUsers = await prisma.user.findMany({
    where: { role: "HR_OFFICER", deletedAt: null },
    select: {
      id: true,
      name: true,
      username: true,
      employee: {
        select: {
          id: true,
          employeeId: true,
          departmentId: true,
          department: { select: { name: true } },
        },
      },
    },
  });

  // Incorrect HR_OFFICER = user linked to an employee whose department is NOT HR
  const incorrectHrOfficers = hrOfficerUsers.filter(
    (u) => u.employee?.department?.name !== HR_DEPARTMENT_NAME
  );

  // ── 3. Report ─────────────────────────────────────────────────────────────
  const totalIssues = incorrectManagers.length + incorrectHrOfficers.length;

  if (totalIssues === 0) {
    console.log("✅  No incorrect role assignments found. Nothing to correct.\n");
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${totalIssues} incorrect role assignment(s):\n`);
  console.log("┌─────────────────────────────────────────────────────────────────┐");
  console.log("│ User ID           │ Username       │ Current Role │ Dept        │ Suggested Role");
  console.log("├─────────────────────────────────────────────────────────────────┤");

  const corrections: Array<{
    userId: string;
    currentRole: string;
    newRole: string;
    username: string;
    employeeId: string | undefined;
    deptName: string | undefined;
  }> = [];

  for (const u of incorrectManagers) {
    const deptName = u.employee?.department?.name ?? "(no dept)";
    const newRole = u.employee?.departmentId ? "DEPT_MANAGER" : "EMPLOYEE";
    console.log(`│ ${u.id.padEnd(18)} │ ${(u.username ?? "").padEnd(14)} │ MANAGER      │ ${deptName.padEnd(12)} │ ${newRole}`);
    corrections.push({
      userId: u.id,
      currentRole: "MANAGER",
      newRole,
      username: u.username ?? u.id,
      employeeId: u.employee?.employeeId,
      deptName,
    });
  }

  for (const u of incorrectHrOfficers) {
    const deptName = u.employee?.department?.name ?? "(no dept)";
    const newRole = u.employee?.departmentId ? "DEPT_MANAGER" : "EMPLOYEE";
    console.log(`│ ${u.id.padEnd(18)} │ ${(u.username ?? "").padEnd(14)} │ HR_OFFICER   │ ${deptName.padEnd(12)} │ ${newRole}`);
    corrections.push({
      userId: u.id,
      currentRole: "HR_OFFICER",
      newRole,
      username: u.username ?? u.id,
      employeeId: u.employee?.employeeId,
      deptName,
    });
  }

  console.log("└─────────────────────────────────────────────────────────────────┘\n");

  // ── 4. Apply corrections (only with --apply flag) ─────────────────────────
  if (!APPLY) {
    console.log("Run with --apply to apply these corrections.");
    console.log("⚠️  REVIEW THE TABLE ABOVE CAREFULLY before applying.\n");
    await prisma.$disconnect();
    return;
  }

  console.log("Applying corrections…\n");
  let corrected = 0;

  for (const c of corrections) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: c.userId },
        data: { role: c.newRole as import("@prisma/client").Role },
      }),
      prisma.auditLog.create({
        data: {
          action: "ROLE_CORRECTION",
          entity: "User",
          entityId: c.userId,
          changes: {
            script: "role-correction.ts",
            username: c.username,
            employeeId: c.employeeId ?? null,
            department: c.deptName ?? null,
            from: c.currentRole,
            to: c.newRole,
          },
        },
      }),
    ]);
    console.log(`  ✓ ${c.username}: ${c.currentRole} → ${c.newRole}`);
    corrected++;
  }

  console.log(`\n✅  ${corrected} correction(s) applied and audit-logged.\n`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error running role-correction script:", err);
  process.exit(1);
});
