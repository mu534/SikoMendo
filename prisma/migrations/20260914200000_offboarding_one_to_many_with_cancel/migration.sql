-- Migration: offboarding_one_to_many_with_cancel
--
-- Changes:
--   1. Remove the UNIQUE constraint on offboarding_record.employeeId so an
--      employee can have multiple historical offboarding records.
--   2. Add cancelledAt and cancelledById columns (audit-preserving cancellation).
--   3. Add FK for cancelledById → user.id (SET NULL on delete).
--   4. Add composite index on (employeeId, completedAt) and plain (employeeId).

-- Step 1: Drop the unique constraint on employeeId
DROP INDEX IF EXISTS "offboarding_record_employeeId_key";

-- Step 2: Add cancellation audit columns
ALTER TABLE "offboarding_record"
  ADD COLUMN IF NOT EXISTS "cancelledAt"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelledById"  TEXT;

-- Step 3: Add FK for cancelledById
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'offboarding_record_cancelledById_fkey'
  ) THEN
    ALTER TABLE "offboarding_record"
      ADD CONSTRAINT "offboarding_record_cancelledById_fkey"
        FOREIGN KEY ("cancelledById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- Step 4: Plain index on employeeId (replaces the dropped unique index)
CREATE INDEX IF NOT EXISTS "offboarding_record_employeeId_idx"
  ON "offboarding_record"("employeeId");

-- Step 5: Composite index for "find active offboarding" queries
CREATE INDEX IF NOT EXISTS "offboarding_record_employeeId_completedAt_idx"
  ON "offboarding_record"("employeeId", "completedAt");
