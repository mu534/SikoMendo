/*
  Warnings:

  - You are about to drop the column `cooperativeId` on the `employee` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "employee" DROP CONSTRAINT "employee_cooperativeId_fkey";

-- DropIndex
DROP INDEX "employee_cooperativeId_idx";

-- AlterTable
ALTER TABLE "employee" DROP COLUMN "cooperativeId";
