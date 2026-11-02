-- AlterTable
ALTER TABLE "employee" ADD COLUMN     "emergencyContact2Name" TEXT,
ADD COLUMN     "emergencyContact2Phone" TEXT,
ADD COLUMN     "emergencyContact2Relationship" TEXT,
ADD COLUMN     "emergencyContactAddressCity" TEXT,
ADD COLUMN     "emergencyContactAddressPostalCode" TEXT,
ADD COLUMN     "emergencyContactAddressRegion" TEXT,
ADD COLUMN     "emergencyContactAltPhone" TEXT,
ADD COLUMN     "emergencyContactConsentAt" TIMESTAMP(3),
ADD COLUMN     "emergencyContactConsentByUserId" TEXT,
ADD COLUMN     "emergencyContactConsentRecorded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emergencyContactEmail" TEXT;
