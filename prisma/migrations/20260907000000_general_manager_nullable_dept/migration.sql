-- Allow General Manager employees to exist without a department or position.
-- Existing employees are unaffected — they already have these values set.

-- Drop FK constraints first (required before altering column nullability)
ALTER TABLE "employee" DROP CONSTRAINT IF EXISTS "employee_departmentId_fkey";
ALTER TABLE "employee" DROP CONSTRAINT IF EXISTS "employee_positionId_fkey";

-- Make columns nullable
ALTER TABLE "employee" ALTER COLUMN "departmentId" DROP NOT NULL;
ALTER TABLE "employee" ALTER COLUMN "positionId"   DROP NOT NULL;

-- Re-add FK constraints (now allowing NULL)
ALTER TABLE "employee"
  ADD CONSTRAINT "employee_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "department"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee"
  ADD CONSTRAINT "employee_positionId_fkey"
  FOREIGN KEY ("positionId") REFERENCES "position"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
