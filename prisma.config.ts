import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL || "postgresql://postgres:mudasir@127.0.0.1:5432/siko_mendo_hris?schema=public",
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
