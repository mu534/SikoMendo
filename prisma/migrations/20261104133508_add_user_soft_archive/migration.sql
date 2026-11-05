-- AlterTable: add soft-archive timestamp to the user table.
-- NULL means the account is active; a non-null timestamp means it is archived.
ALTER TABLE "user" ADD COLUMN "deletedAt" TIMESTAMP(3);
