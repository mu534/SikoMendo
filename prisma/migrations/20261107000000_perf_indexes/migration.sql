-- Migration: perf_indexes
-- Adds two composite indexes to improve navigation performance:
--
--   1. attendance(date, status)        — the daily register status filter was
--                                        hitting only the single-column date
--                                        index and then scanning all rows for
--                                        that date to match status.
--
--   2. employee(managerId, deletedAt)  — the recursive CTE for subordinate
--                                        resolution (and scoped employee list)
--                                        filters on both columns together.

CREATE INDEX CONCURRENTLY IF NOT EXISTS "attendance_date_status_idx"
    ON "attendance" ("date", "status");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "employee_managerId_deletedAt_idx"
    ON "employee" ("managerId", "deletedAt");
