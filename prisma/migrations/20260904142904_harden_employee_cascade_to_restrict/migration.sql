-- DropForeignKey
ALTER TABLE "attendance" DROP CONSTRAINT "attendance_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "contract" DROP CONSTRAINT "contract_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "document" DROP CONSTRAINT "document_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "employment_history" DROP CONSTRAINT "employment_history_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "leave_request" DROP CONSTRAINT "leave_request_employeeId_fkey";

-- AddForeignKey
ALTER TABLE "employment_history" ADD CONSTRAINT "employment_history_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_request" ADD CONSTRAINT "leave_request_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
