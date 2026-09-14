-- AlterTable
ALTER TABLE "employee" ADD COLUMN     "shiftId" TEXT;

-- CreateTable
CREATE TABLE "work_shift" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "work_shift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "work_shift_name_key" ON "work_shift"("name");

-- CreateIndex
CREATE INDEX "employee_shiftId_idx" ON "employee"("shiftId");

-- AddForeignKey
ALTER TABLE "employee" ADD CONSTRAINT "employee_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "work_shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_shift" ADD CONSTRAINT "work_shift_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
