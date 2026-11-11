-- Add grace period to attendance policy.
-- graceMinutes: check-ins within this many minutes after the session deadline → LATE
-- (instead of ABSENT). Auto-absence detection fires at deadline + graceMinutes.
ALTER TABLE "attendance_policy" ADD COLUMN "graceMinutes" INTEGER NOT NULL DEFAULT 15;
