-- Drop legacy inline education columns from the employee table.
--
-- These columns were kept through the previous migration to allow the form
-- and API to continue working while the one-to-many Education table was
-- introduced and backfilled. Now that all reads and writes go through the
-- Education table, the inline fields can be removed.
--
-- Data was already backfilled in migration 20260916000000. Any remaining
-- NULL rows had no education data and produce zero Education rows (correct).
--
-- Additive schema change on the Prisma side: Employee model fields
-- educationLevel, fieldOfStudy, institutionName, graduationYear are removed.

ALTER TABLE "employee"
  DROP COLUMN IF EXISTS "educationLevel",
  DROP COLUMN IF EXISTS "fieldOfStudy",
  DROP COLUMN IF EXISTS "institutionName",
  DROP COLUMN IF EXISTS "graduationYear";
