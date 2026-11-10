-- DropIndex
DROP INDEX "audit_log_action_createdAt_idx";

-- DropIndex
DROP INDEX "audit_log_entity_createdAt_idx";

-- DropIndex
DROP INDEX "audit_log_userId_createdAt_idx";

-- CreateIndex
CREATE INDEX "audit_log_userId_createdAt_idx" ON "audit_log"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_log_entity_createdAt_idx" ON "audit_log"("entity", "createdAt");

-- CreateIndex
CREATE INDEX "audit_log_action_createdAt_idx" ON "audit_log"("action", "createdAt");
