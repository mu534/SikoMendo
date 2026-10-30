-- Add locale preference field to the user table.
-- Existing users default to English; the app language switcher updates this field.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "locale" TEXT NOT NULL DEFAULT 'en';
