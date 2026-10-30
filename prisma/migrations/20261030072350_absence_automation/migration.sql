-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ABSENCE_DETECTED';

-- AlterTable
ALTER TABLE "attendance" ADD COLUMN     "autoRecorded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "correctedById" TEXT,
ADD COLUMN     "correctionNote" TEXT;

-- AlterTable
ALTER TABLE "attendance_policy" ADD COLUMN     "absenceDetectionTime" TEXT NOT NULL DEFAULT '10:00';

-- CreateIndex
CREATE INDEX "attendance_correctedById_idx" ON "attendance"("correctedById");

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_correctedById_fkey" FOREIGN KEY ("correctedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
