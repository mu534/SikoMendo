-- AddColumn: legal certificate fields on cooperative
-- Additive only — no existing columns are dropped or renamed.

ALTER TABLE "cooperative"
  ADD COLUMN IF NOT EXISTS "legalCertificateKey"          TEXT,
  ADD COLUMN IF NOT EXISTS "legalCertificateUrl"          TEXT,
  ADD COLUMN IF NOT EXISTS "legalCertificateResourceType" TEXT,
  ADD COLUMN IF NOT EXISTS "legalCertificateFileName"     TEXT,
  ADD COLUMN IF NOT EXISTS "legalCertificateFileSize"     INTEGER;
