-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EmploymentStatus" ADD VALUE 'ON_LEAVE';
ALTER TYPE "EmploymentStatus" ADD VALUE 'RESIGNED';
ALTER TYPE "EmploymentStatus" ADD VALUE 'RETIRED';

-- AlterTable
ALTER TABLE "employee" ADD COLUMN     "educationLevel" TEXT,
ADD COLUMN     "emergencyContactName" TEXT,
ADD COLUMN     "emergencyContactPhone" TEXT,
ADD COLUMN     "employmentType" TEXT,
ADD COLUMN     "fieldOfStudy" TEXT,
ADD COLUMN     "graduationYear" TEXT,
ADD COLUMN     "institutionName" TEXT,
ADD COLUMN     "maritalStatus" TEXT,
ADD COLUMN     "profileImageKey" TEXT;
