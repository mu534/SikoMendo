/*
 * BACKFILL RUN OUTPUT (2026-11-07):
 *
 * GM managerId already null — no change needed.
 * All active DMs already have correct managerId — no DM changes needed.
 * All active ordinary employees already have correct managerId — no changes needed.
 *
 * ─── Backfill Summary ───────────────────────────────────
 *   GM fixed:                 0
 *   DMs fixed:                0
 *   Ordinary employees fixed: 0
 *   Warnings:                 0
 *   Skipped (no dept):        0
 * ────────────────────────────────────────────────────────
 *
 * Script is idempotent — ran twice, identical results both times.
 * No WARNINGs about departments without active DMs.
 * All existing employee data was already compliant with the three-tier hierarchy
 * (FEAT-001/002 enforcement was in place before this backfill ran).
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import prisma from '../../../lib/prisma';

async function main() {
  let gmFixed = 0;
  let dmFixed = 0;
  let empFixed = 0;
  let warnings = 0;
  let skips = 0;

  // ── A) Fix GM (MANAGER role) ──────────────────────────────────────────────
  const gmUser = await prisma.user.findFirst({
    where: { role: 'MANAGER', banned: false, deletedAt: null },
    select: { employee: { select: { id: true, managerId: true } } },
  });

  let gmEmployeeId: string | null = null;

  if (gmUser?.employee) {
    gmEmployeeId = gmUser.employee.id;
    if (gmUser.employee.managerId !== null) {
      await prisma.employee.update({
        where: { id: gmEmployeeId },
        data: { managerId: null },
      });
      console.log('Fixed GM managerId: cleared to null');
      gmFixed++;
    } else {
      console.log('GM managerId already null — no change needed.');
    }
  } else {
    console.log('WARNING: No active GM (MANAGER role) found — GM fix skipped.');
    warnings++;
  }

  // ── B) Fix Department Managers ────────────────────────────────────────────
  if (gmEmployeeId === null) {
    console.log(
      'WARNING: No active GM found — DM managerId cannot be set. Appoint a GM first, then re-run this script.'
    );
    warnings++;
  } else {
    const dmUsers = await prisma.user.findMany({
      where: { role: 'DEPT_MANAGER', banned: false, deletedAt: null },
      select: { employee: { select: { id: true, managerId: true, departmentId: true } } },
    });

    for (const dmUser of dmUsers) {
      if (!dmUser.employee) continue;
      const dm = dmUser.employee;
      if (dm.managerId !== gmEmployeeId) {
        await prisma.employee.update({
          where: { id: dm.id },
          data: { managerId: gmEmployeeId },
        });
        console.log(`Fixed DM ${dm.id}: managerId set to GM`);
        dmFixed++;
      }
    }

    if (dmFixed === 0) {
      console.log('All active DMs already have correct managerId — no DM changes needed.');
    }
  }

  // ── C) Fix ordinary employees ─────────────────────────────────────────────
  // Fetch all ACTIVE employees whose user role is not MANAGER or DEPT_MANAGER.
  // Include employees without a user account (user === null) — treat them as ordinary.
  const allActiveEmployees = await prisma.employee.findMany({
    where: {
      employmentStatus: 'ACTIVE',
      deletedAt: null,
    },
    select: {
      id: true,
      managerId: true,
      departmentId: true,
      user: { select: { role: true } },
    },
  });

  for (const emp of allActiveEmployees) {
    // Skip GM and DM — handled above
    const role = emp.user?.role ?? null;
    if (role === 'MANAGER' || role === 'DEPT_MANAGER') continue;

    if (!emp.departmentId) {
      console.log(`SKIP ${emp.id}: no department assigned`);
      skips++;
      continue;
    }

    const dept = await prisma.department.findUnique({
      where: { id: emp.departmentId },
      select: {
        managerId: true,
        manager: { select: { deletedAt: true, employmentStatus: true } },
      },
    });

    // Check for an active DM: managerId must be non-null, manager not archived,
    // and manager.employmentStatus must be ACTIVE.
    const hasActiveDM =
      dept?.managerId != null &&
      dept.manager?.deletedAt == null &&
      dept.manager?.employmentStatus === 'ACTIVE';

    if (!hasActiveDM) {
      console.log(
        `WARNING ${emp.id}: dept ${emp.departmentId} has no active DM — managerId left as-is`
      );
      warnings++;
      continue;
    }

    if (emp.managerId !== dept!.managerId) {
      await prisma.employee.update({
        where: { id: emp.id },
        data: { managerId: dept!.managerId },
      });
      console.log(`Fixed employee ${emp.id}: managerId set to ${dept!.managerId}`);
      empFixed++;
    }
  }

  if (empFixed === 0) {
    console.log('All active ordinary employees already have correct managerId — no changes needed.');
  }

  // ── D) Summary ────────────────────────────────────────────────────────────
  console.log('\n─── Backfill Summary ───────────────────────────────────');
  console.log(`  GM fixed:                 ${gmFixed}`);
  console.log(`  DMs fixed:                ${dmFixed}`);
  console.log(`  Ordinary employees fixed: ${empFixed}`);
  console.log(`  Warnings:                 ${warnings}`);
  console.log(`  Skipped (no dept):        ${skips}`);
  console.log('────────────────────────────────────────────────────────');
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
