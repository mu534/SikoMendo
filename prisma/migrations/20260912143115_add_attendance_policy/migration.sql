-- CreateTable
CREATE TABLE "attendance_policy" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "workStartTime" TEXT NOT NULL DEFAULT '08:00',
    "workEndTime" TEXT NOT NULL DEFAULT '17:00',
    "gracePeriodMinutes" INTEGER NOT NULL DEFAULT 15,
    "halfDayThresholdMinutes" INTEGER,
    "workingDays" TEXT NOT NULL DEFAULT '[1,2,3,4,5]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "attendance_policy_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "attendance_policy" ADD CONSTRAINT "attendance_policy_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
