/**
 * Guarded integration test for attendance session schema constraints.
 *
 * This test runs ONLY when TEST_DATABASE_URL is set in the environment.
 * It is skipped (not failed) otherwise, so the default `npm test` suite
 * remains unit-only and green in any environment.
 *
 * Run with:
 *   TEST_DATABASE_URL=postgresql://... npx vitest run lib/attendance-session.integration.test.ts
 *
 * Before running, ensure the schema is applied to the test DB:
 *   DATABASE_URL=<TEST_DATABASE_URL> npx prisma db push
 *
 * What is verified:
 *   AC-5  — a second Attendance row with the same (employeeId, date, session)
 *           is rejected by the database unique constraint (Prisma error P2002).
 *   AC-4  — a row with a different session for the same (employeeId, date)
 *           is accepted (two rows per employee per day allowed).
 *   AC-16 — createMany({ skipDuplicates: true }) on an already-existing
 *           (employeeId, date, session) returns { count: 0 } (no new row).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Guard: skip the entire file when TEST_DATABASE_URL is not set.
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const shouldRun = !!TEST_DATABASE_URL;

// Use a unique test employee ID to avoid collisions with existing data.
const TEST_EMPLOYEE_ID = `test-integration-${Date.now()}`;
const TEST_DATE = new Date("2026-01-12T00:00:00.000Z"); // 2026-01-12 (Monday)

let prisma: PrismaClient | null = null;
let pool: Pool | null = null;

beforeAll(async () => {
  if (!shouldRun) return;
  pool = new Pool({ connectionString: TEST_DATABASE_URL });
  const adapter = new PrismaPg({ connectionString: TEST_DATABASE_URL! });
  prisma = new PrismaClient({ adapter });
  // Clean up any leftover rows from a previous failed run
  await prisma.attendance.deleteMany({
    where: { employeeId: TEST_EMPLOYEE_ID },
  });
});

afterAll(async () => {
  if (!prisma) return;
  // Clean up integration test rows
  await prisma.attendance.deleteMany({
    where: { employeeId: TEST_EMPLOYEE_ID },
  });
  await prisma.$disconnect();
  await pool?.end();
});

describe.skipIf(!shouldRun)("Attendance session DB constraints (integration)", () => {
  it("AC-4: two session rows can coexist for the same (employeeId, date)", async () => {
    if (!prisma) return;

    // Insert MORNING row
    const morning = await prisma.attendance.create({
      data: {
        employeeId: TEST_EMPLOYEE_ID,
        date:       TEST_DATE,
        session:    "MORNING",
        status:     "ABSENT",
        autoRecorded: true,
      },
    });
    expect(morning.id).toBeTruthy();

    // Insert AFTERNOON row for the same employee/date — must succeed
    const afternoon = await prisma.attendance.create({
      data: {
        employeeId: TEST_EMPLOYEE_ID,
        date:       TEST_DATE,
        session:    "AFTERNOON",
        status:     "ABSENT",
        autoRecorded: true,
      },
    });
    expect(afternoon.id).toBeTruthy();
    expect(afternoon.id).not.toBe(morning.id);
  });

  it("AC-5: inserting a duplicate (employeeId, date, session) is rejected with P2002", async () => {
    if (!prisma) return;

    // A MORNING row already exists from the previous test; try to insert another
    await expect(
      prisma.attendance.create({
        data: {
          employeeId: TEST_EMPLOYEE_ID,
          date:       TEST_DATE,
          session:    "MORNING",
          status:     "PRESENT",
          autoRecorded: false,
        },
      })
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("AC-16: createMany with skipDuplicates returns count:0 for an existing (employeeId, date, session)", async () => {
    if (!prisma) return;

    // Both MORNING and AFTERNOON rows already exist — createMany should return count:0
    const result = await prisma.attendance.createMany({
      data: [
        {
          employeeId:   TEST_EMPLOYEE_ID,
          date:         TEST_DATE,
          session:      "MORNING",
          status:       "ABSENT",
          autoRecorded: true,
        },
        {
          employeeId:   TEST_EMPLOYEE_ID,
          date:         TEST_DATE,
          session:      "AFTERNOON",
          status:       "ABSENT",
          autoRecorded: true,
        },
      ],
      skipDuplicates: true,
    });
    expect(result.count).toBe(0);
  });
});
