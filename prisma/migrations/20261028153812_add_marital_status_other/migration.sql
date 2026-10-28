-- Add OTHER value to the MaritalStatus enum.
-- This is an additive change — existing SINGLE/MARRIED/DIVORCED/WIDOWED rows
-- are unaffected. IF NOT EXISTS is supported in PostgreSQL 9.6+ and is used
-- here so re-running the migration is safe (idempotent).
ALTER TYPE "MaritalStatus" ADD VALUE IF NOT EXISTS 'OTHER';
