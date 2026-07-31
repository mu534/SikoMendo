/*
  Warnings:

  - You are about to drop the column `department` on the `employee` table. All the data in the column will be lost.
  - You are about to drop the column `position` on the `employee` table. All the data in the column will be lost.
  - The `educationLevel` column on the `employee` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `employmentType` column on the `employee` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `maritalStatus` column on the `employee` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[username]` on the table `user` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `departmentId` to the `employee` table without a default value. This is not possible if the table is not empty.
  - Added the required column `positionId` to the `employee` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('PERMANENT', 'CONTRACT', 'TEMPORARY', 'PROBATION', 'INTERNSHIP');

-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('PRIMARY', 'SECONDARY', 'CERTIFICATE', 'DIPLOMA', 'BACHELOR', 'MASTER', 'PHD');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('ANNUAL', 'SICK', 'EMERGENCY', 'MATERNITY', 'PATERNITY', 'UNPAID');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "AttendanceStatus" ADD VALUE 'ON_LEAVE';

-- AlterEnum
ALTER TYPE "ReportType" ADD VALUE 'LEAVE_SUMMARY';

-- DropIndex
DROP INDEX "employee_department_idx";

-- AlterTable
ALTER TABLE "employee" DROP COLUMN "department",
DROP COLUMN "position",
ADD COLUMN     "departmentId" TEXT NOT NULL,
ADD COLUMN     "emergencyContactAddress" TEXT,
ADD COLUMN     "emergencyContactRelationship" TEXT,
ADD COLUMN     "middleName" TEXT,
ADD COLUMN     "positionId" TEXT NOT NULL,
DROP COLUMN "educationLevel",
ADD COLUMN     "educationLevel" "EducationLevel",
DROP COLUMN "employmentType",
ADD COLUMN     "employmentType" "EmploymentType",
DROP COLUMN "maritalStatus",
ADD COLUMN     "maritalStatus" "MaritalStatus";

-- AlterTable
ALTER TABLE "session" ADD COLUMN     "impersonatedBy" TEXT;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "displayUsername" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "middleName" TEXT,
ADD COLUMN     "username" TEXT;

-- CreateTable
CREATE TABLE "department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "position" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_request" (
    "id" TEXT NOT NULL,
    "leaveId" TEXT NOT NULL,
    "leaveType" "LeaveType" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "totalDays" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "documentUrl" TEXT,
    "documentKey" TEXT,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "appliedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decisionDate" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "employeeId" TEXT NOT NULL,
    "approverId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_entitlement" (
    "id" TEXT NOT NULL,
    "leaveType" "LeaveType" NOT NULL,
    "daysPerYear" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "department_name_key" ON "department"("name");

-- CreateIndex
CREATE INDEX "position_departmentId_idx" ON "position"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "position_departmentId_name_key" ON "position"("departmentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "leave_request_leaveId_key" ON "leave_request"("leaveId");

-- CreateIndex
CREATE INDEX "leave_request_employeeId_idx" ON "leave_request"("employeeId");

-- CreateIndex
CREATE INDEX "leave_request_status_idx" ON "leave_request"("status");

-- CreateIndex
CREATE INDEX "leave_request_leaveType_idx" ON "leave_request"("leaveType");

-- CreateIndex
CREATE INDEX "leave_request_startDate_idx" ON "leave_request"("startDate");

-- CreateIndex
CREATE INDEX "leave_request_approverId_idx" ON "leave_request"("approverId");

-- CreateIndex
CREATE UNIQUE INDEX "leave_entitlement_leaveType_key" ON "leave_entitlement"("leaveType");

-- CreateIndex
CREATE INDEX "employee_departmentId_idx" ON "employee"("departmentId");

-- CreateIndex
CREATE INDEX "employee_positionId_idx" ON "employee"("positionId");

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- AddForeignKey
ALTER TABLE "employee" ADD CONSTRAINT "employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee" ADD CONSTRAINT "employee_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position" ADD CONSTRAINT "position_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_request" ADD CONSTRAINT "leave_request_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_request" ADD CONSTRAINT "leave_request_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
