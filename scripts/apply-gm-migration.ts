import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { Pool } from "pg";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query(`ALTER TABLE "employee" DROP CONSTRAINT IF EXISTS "employee_departmentId_fkey"`);
    await client.query(`ALTER TABLE "employee" DROP CONSTRAINT IF EXISTS "employee_positionId_fkey"`);
    await client.query(`ALTER TABLE "employee" ALTER COLUMN "departmentId" DROP NOT NULL`);
    await client.query(`ALTER TABLE "employee" ALTER COLUMN "positionId" DROP NOT NULL`);
    await client.query(`ALTER TABLE "employee" ADD CONSTRAINT "employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "department"("id") ON DELETE RESTRICT ON UPDATE CASCADE`);
    await client.query(`ALTER TABLE "employee" ADD CONSTRAINT "employee_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "position"("id") ON DELETE RESTRICT ON UPDATE CASCADE`);
    console.log("✅ Migration applied: departmentId and positionId are now nullable.");
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch((e) => { console.error("❌", e); process.exit(1); });
