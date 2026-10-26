-- Education records: one-to-many model for employee education history.
--
-- Additive only. No existing columns are dropped or renamed — the legacy
-- inline education fields on "employee" (educationLevel, fieldOfStudy,
-- institutionName, graduationYear) are kept for now and will be removed in a
-- later migration once the form/API read & write the new "education" table.
--
-- This migration:
--   1. Adds HIGH_SCHOOL and OTHER to the existing "EducationLevel" enum.
--   2. Creates new "InstitutionType" and "QualificationStatus" enums.
--   3. Creates the "education" table (one row per qualification, FK -> employee).
--   4. Backfills one Education row per employee that has any legacy education
--      data. graduationYear is safe-cast to an int only when it is a clean
--      4-digit year (^\d{4}$); otherwise it becomes NULL so bad legacy strings
--      never fail the migration. institutionType and qualificationStatus are
--      unknown for legacy rows and left NULL.

-- AlterEnum
ALTER TYPE "EducationLevel" ADD VALUE 'HIGH_SCHOOL';

-- AlterEnum
ALTER TYPE "EducationLevel" ADD VALUE 'OTHER';

-- CreateEnum
CREATE TYPE "InstitutionType" AS ENUM ('HIGH_SCHOOL', 'UNIVERSITY', 'COLLEGE', 'TVET', 'OTHER');

-- CreateEnum
CREATE TYPE "QualificationStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "education" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "educationLevel" "EducationLevel" NOT NULL,
    "fieldOfStudy" TEXT,
    "institutionType" "InstitutionType",
    "institutionName" TEXT,
    "graduationYear" INTEGER,
    "qualificationStatus" "QualificationStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "education_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "education_employeeId_idx" ON "education"("employeeId");

-- AddForeignKey
ALTER TABLE "education" ADD CONSTRAINT "education_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: copy legacy inline education fields into one Education row per
-- employee that has any education data. Safe-casts graduationYear to int.
INSERT INTO "education" (
    "id", "employeeId", "educationLevel", "fieldOfStudy",
    "institutionName", "graduationYear", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    e."id",
    e."educationLevel",
    NULLIF(TRIM(e."fieldOfStudy"), ''),
    NULLIF(TRIM(e."institutionName"), ''),
    CASE
        WHEN e."graduationYear" IS NOT NULL
             AND TRIM(e."graduationYear") ~ '^\d{4}$'
        THEN CAST(TRIM(e."graduationYear") AS INTEGER)
        ELSE NULL
    END,
    NOW(),
    NOW()
FROM "employee" e
WHERE e."educationLevel" IS NOT NULL
   OR NULLIF(TRIM(e."fieldOfStudy"), '') IS NOT NULL
   OR NULLIF(TRIM(e."institutionName"), '') IS NOT NULL
   OR (
        e."graduationYear" IS NOT NULL
        AND TRIM(e."graduationYear") ~ '^\d{4}$'
   );
