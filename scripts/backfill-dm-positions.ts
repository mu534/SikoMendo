/**
 * backfill-dm-positions.ts
 *
 * One-time script to fix existing DM employees who have positionId = null
 * because they were appointed before the auto-assign fix (commit a95b5b8).
 *
 * For each active Department Manager with no positionId, this script:
 *   1. Looks up the department's manager-type position (name ILIKE '%Manager%')
 *   2. If found, sets the employee's positionId to that position's ID
 *   3. Logs the result for every employee — skips gracefully if no position found
 *
 * Run with:
 *   npx tsx scripts/backfill-dm-positions.ts
 *
 * Safe to run multiple times — skips employees who already have a positionId.
 */

import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

dotenv.config({ path: '.env.local' })

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🔍 Finding DM employees with no positionId...\n')

  const departments = await prisma.department.findMany({
    where: { managerId: { not: null } },
    include: {
      manager: true,
      positions: {
        where: {
          name: { contains: 'Manager', mode: 'insensitive' },
        },
      },
    },
  })

  const toFix = departments.filter(
    (d) => d.manager && d.manager.deletedAt === null && d.manager.positionId === null
  )

  if (toFix.length === 0) {
    console.log('✅ No DM employees need backfilling — all positionIds are already set.')
    return
  }

  console.log(`Found ${toFix.length} DM employee(s) to backfill:\n`)

  let fixed = 0
  let skipped = 0

  for (const dept of toFix) {
    const employee = dept.manager!
    const managerPosition = dept.positions[0] ?? null

    if (!managerPosition) {
      console.warn(
        `⚠️  SKIP — ${employee.firstName} ${employee.lastName} (dept: "${dept.name}"): no manager-type position found in this department.`
      )
      skipped++
      continue
    }

    await prisma.employee.update({
      where: { id: employee.id },
      data: { positionId: managerPosition.id },
    })

    console.log(
      `✅ FIXED — ${employee.firstName} ${employee.lastName} (dept: "${dept.name}"): positionId set to "${managerPosition.name}" (${managerPosition.id})`
    )
    fixed++
  }

  console.log(`\nDone. ${fixed} fixed, ${skipped} skipped.`)
}

main()
  .catch((err) => {
    console.error('❌ Script failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
