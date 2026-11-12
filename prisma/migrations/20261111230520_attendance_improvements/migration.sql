-- Add separate grace period fields to AttendancePolicy
ALTER TABLE "attendance_policy"
  ADD COLUMN IF NOT EXISTS "morningGraceMinutes" INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS "afternoonGraceMinutes" INTEGER NOT NULL DEFAULT 15;

UPDATE "attendance_policy"
  SET "morningGraceMinutes" = COALESCE("graceMinutes", 15),
      "afternoonGraceMinutes" = COALESCE("graceMinutes", 15);

-- Make graceMinutes nullable (backward-compat — will be removed in a later migration)
ALTER TABLE "attendance_policy"
  ALTER COLUMN "graceMinutes" DROP NOT NULL;

-- Add HOLIDAY to AttendanceStatus enum
ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'HOLIDAY';

-- Create CalendarType enum
CREATE TYPE IF NOT EXISTS "CalendarType" AS ENUM (
  'PUBLIC_HOLIDAY', 'RELIGIOUS_HOLIDAY', 'ORG_HOLIDAY',
  'SPECIAL_NON_WORKING', 'SPECIAL_WORKING'
);

-- Create attendance_calendar table
CREATE TABLE IF NOT EXISTS "attendance_calendar" (
  "id"           TEXT NOT NULL,
  "date"         DATE NOT NULL,
  "name"         TEXT NOT NULL,
  "calendarType" "CalendarType" NOT NULL,
  "description"  TEXT,
  "isWorkingDay" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  "createdById"  TEXT,
  CONSTRAINT "attendance_calendar_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_calendar_date_key" UNIQUE ("date"),
  CONSTRAINT "attendance_calendar_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "attendance_calendar_date_idx" ON "attendance_calendar"("date");
