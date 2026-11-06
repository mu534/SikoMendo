-- CreateEnum
CREATE TYPE "BackupUploadStatus" AS ENUM ('PENDING', 'UPLOADED', 'FAILED');

-- CreateEnum
CREATE TYPE "BackupRecordStatus" AS ENUM ('COMPLETED', 'FAILED', 'RESTORED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "BackupSource" AS ENUM ('MANUAL', 'SAFETY', 'UPLOAD');

-- AlterTable
ALTER TABLE "employment_history" ADD COLUMN     "newManagerId" TEXT,
ADD COLUMN     "previousDepartmentId" TEXT,
ADD COLUMN     "previousManagerId" TEXT,
ADD COLUMN     "previousPositionId" TEXT,
ADD COLUMN     "recordedById" TEXT;

-- CreateTable
CREATE TABLE "backup_record" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "formatVersion" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "publicId" TEXT NOT NULL DEFAULT '',
    "cloudinaryUploadStatus" "BackupUploadStatus" NOT NULL DEFAULT 'PENDING',
    "backupStatus" "BackupRecordStatus" NOT NULL DEFAULT 'COMPLETED',
    "source" "BackupSource" NOT NULL DEFAULT 'MANUAL',
    "notes" TEXT,
    "createdById" TEXT,

    CONSTRAINT "backup_record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "backup_record_publicId_key" ON "backup_record"("publicId");

-- CreateIndex
CREATE INDEX "backup_record_createdById_idx" ON "backup_record"("createdById");

-- CreateIndex
CREATE INDEX "backup_record_createdAt_idx" ON "backup_record"("createdAt");

-- CreateIndex
CREATE INDEX "employment_history_recordedById_idx" ON "employment_history"("recordedById");

-- AddForeignKey
ALTER TABLE "employment_history" ADD CONSTRAINT "employment_history_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_record" ADD CONSTRAINT "backup_record_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
