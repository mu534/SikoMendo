-- Migration: add_dept_manager_role_and_department_manager
-- Adds the DEPT_MANAGER role enum value and the managerId FK on the
-- department table (tracks which employee is the Department Manager).

-- 1. Add new Role enum value
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'DEPT_MANAGER';

-- 2. Add managerId column to department
ALTER TABLE "department" ADD COLUMN IF NOT EXISTS "managerId" TEXT;

-- 3. Unique constraint (one manager per department)
CREATE UNIQUE INDEX IF NOT EXISTS "department_managerId_key"
  ON "department"("managerId");

-- 4. Foreign key — SetNull on employee delete
ALTER TABLE "department"
  ADD CONSTRAINT "department_managerId_fkey"
  FOREIGN KEY ("managerId")
  REFERENCES "employee"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE
  DEFERRABLE INITIALLY DEFERRED;
