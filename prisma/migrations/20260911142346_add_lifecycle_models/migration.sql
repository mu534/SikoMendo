/*
  Warnings:

  - You are about to drop the `backup_log` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "OffboardingReason" AS ENUM ('RESIGNATION', 'RETIREMENT', 'CONTRACT_END', 'TERMINATION', 'OTHER');

-- AlterEnum
ALTER TYPE "EmploymentStatus" ADD VALUE 'ONBOARDING';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'ONBOARDING_STARTED';
ALTER TYPE "NotificationType" ADD VALUE 'ONBOARDING_COMPLETED';
ALTER TYPE "NotificationType" ADD VALUE 'OFFBOARDING_STARTED';
ALTER TYPE "NotificationType" ADD VALUE 'OFFBOARDING_COMPLETED';
ALTER TYPE "NotificationType" ADD VALUE 'CONTRACT_EXPIRING';
ALTER TYPE "NotificationType" ADD VALUE 'DOCUMENT_MISSING';

-- DropForeignKey
ALTER TABLE "backup_log" DROP CONSTRAINT "backup_log_createdById_fkey";

-- AlterTable
ALTER TABLE "org_settings" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- DropTable
DROP TABLE "backup_log";

-- CreateTable
CREATE TABLE "onboarding_record" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "responsibleHrId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offboarding_record" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "reason" "OffboardingReason" NOT NULL,
    "lastWorkingDate" DATE,
    "notes" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "startedById" TEXT,
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offboarding_record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_record_employeeId_key" ON "onboarding_record"("employeeId");

-- CreateIndex
CREATE INDEX "onboarding_record_completedAt_idx" ON "onboarding_record"("completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "offboarding_record_employeeId_key" ON "offboarding_record"("employeeId");

-- CreateIndex
CREATE INDEX "offboarding_record_completedAt_idx" ON "offboarding_record"("completedAt");

-- AddForeignKey
ALTER TABLE "onboarding_record" ADD CONSTRAINT "onboarding_record_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_record" ADD CONSTRAINT "onboarding_record_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_record" ADD CONSTRAINT "onboarding_record_responsibleHrId_fkey" FOREIGN KEY ("responsibleHrId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offboarding_record" ADD CONSTRAINT "offboarding_record_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offboarding_record" ADD CONSTRAINT "offboarding_record_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offboarding_record" ADD CONSTRAINT "offboarding_record_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
