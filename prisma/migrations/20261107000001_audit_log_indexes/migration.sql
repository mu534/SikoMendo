-- Migration: audit_log_indexes
--
-- The audit log page was slow because:
--   1. The ORDER BY createdAt DESC with optional entity/action/userId filters
--      could only use the single-column indexes, forcing a re-sort pass.
--   2. COUNT(*) ran a second full scan of the same WHERE result.
--
-- These composite indexes let the DB satisfy ORDER BY + filter in one scan
-- for the three most common filter combinations (by entity, action, or user).
-- The window-function query in listAuditLog() now also avoids the second
-- COUNT round-trip entirely.

CREATE INDEX CONCURRENTLY IF NOT EXISTS "audit_log_action_idx"
    ON "audit_log" ("action");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "audit_log_userId_createdAt_idx"
    ON "audit_log" ("userId", "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "audit_log_entity_createdAt_idx"
    ON "audit_log" ("entity", "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "audit_log_action_createdAt_idx"
    ON "audit_log" ("action", "createdAt" DESC);
