-- CreateTable: backup audit log
CREATE TABLE IF NOT EXISTS "backup_log" (
    "id"         TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "status"     TEXT NOT NULL DEFAULT 'PENDING',
    "sizeBytes"  BIGINT,
    "fileKey"    TEXT,
    "fileUrl"    TEXT,
    "notes"      TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "backup_log_pkey" PRIMARY KEY ("id")
);

-- FK to user (nullable — survive user deletion)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'backup_log_createdById_fkey'
  ) THEN
    ALTER TABLE "backup_log"
      ADD CONSTRAINT "backup_log_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "user"("id")
      ON DELETE SET NULL;
  END IF;
END$$;
