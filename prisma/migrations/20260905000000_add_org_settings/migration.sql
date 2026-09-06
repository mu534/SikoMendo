-- CreateTable
CREATE TABLE IF NOT EXISTS "org_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "orgName" TEXT NOT NULL DEFAULT 'Siko Mendo Union',
    "tagline" TEXT NOT NULL DEFAULT 'Union HRMIS',
    "location" TEXT NOT NULL DEFAULT 'Bale Robe, Ethiopia',
    "logoUrl" TEXT,
    "logoKey" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_settings_pkey" PRIMARY KEY ("id")
);
