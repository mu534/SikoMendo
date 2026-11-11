-- Attendance Session Overhaul: add AttendanceSession enum, session column to attendance,
-- widen unique constraint, and replace AttendancePolicy timing fields.

-- New session enum
CREATE TYPE "AttendanceSession" AS ENUM ('MORNING', 'AFTERNOON');

-- Attendance: add NOT NULL session column, back-filling ALL existing rows to MORNING via the default.
-- Safe: old data has at most one row per (employeeId, date), so (employeeId, date, 'MORNING') stays unique.
ALTER TABLE "attendance" ADD COLUMN "session" "AttendanceSession" NOT NULL DEFAULT 'MORNING';

-- Swap the unique constraint: one row per (employee, date, session)
DROP INDEX IF EXISTS "attendance_employeeId_date_key";
CREATE UNIQUE INDEX "attendance_employeeId_date_session_key" ON "attendance"("employeeId", "date", "session");

-- New index for session-scoped queries
CREATE INDEX "attendance_session_idx" ON "attendance"("session");

-- AttendancePolicy: replace the old timing columns with the four session fields (singleton table).
-- This is a destructive column change on a singleton table; the old config is intentionally discarded.
ALTER TABLE "attendance_policy" DROP COLUMN IF EXISTS "workStartTime";
ALTER TABLE "attendance_policy" DROP COLUMN IF EXISTS "workEndTime";
ALTER TABLE "attendance_policy" DROP COLUMN IF EXISTS "gracePeriodMinutes";
ALTER TABLE "attendance_policy" DROP COLUMN IF EXISTS "halfDayThresholdMinutes";
ALTER TABLE "attendance_policy" DROP COLUMN IF EXISTS "absenceDetectionTime";
ALTER TABLE "attendance_policy" ADD COLUMN "morningStartTime"         TEXT NOT NULL DEFAULT '08:00';
ALTER TABLE "attendance_policy" ADD COLUMN "morningCheckInDeadline"   TEXT NOT NULL DEFAULT '08:15';
ALTER TABLE "attendance_policy" ADD COLUMN "afternoonStartTime"       TEXT NOT NULL DEFAULT '13:00';
ALTER TABLE "attendance_policy" ADD COLUMN "afternoonCheckInDeadline" TEXT NOT NULL DEFAULT '13:15';
