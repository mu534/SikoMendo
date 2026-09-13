/**
 * scripts/validate-env.ts
 *
 * Validates that all required environment variables are present and valid.
 * Run before deployments or CI steps that need a real environment.
 *
 * Usage:  npx tsx scripts/validate-env.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" }); // fallback

import { z } from "zod";

const requiredVars = z.object({
  DATABASE_URL: z
    .string()
    .min(1)
    .refine((v) => v.startsWith("postgresql://") || v.startsWith("postgres://"), {
      message: "DATABASE_URL must be a valid PostgreSQL connection string",
    }),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters for security"),
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL must be a valid URL"),
  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL must be a valid URL"),
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY:    z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
});

const result = requiredVars.safeParse(process.env);

if (!result.success) {
  console.error("\n❌ Environment validation failed:\n");
  for (const issue of result.error.issues) {
    const key  = issue.path.join(".");
    const msg  = issue.message;
    const val  = process.env[key];
    const hint = val === undefined ? "(not set)" : val === "" ? "(empty string)" : "(set but invalid)";
    console.error(`  ${key}: ${msg} — ${hint}`);
  }
  console.error("\n  See .env.example for the required format.\n");
  process.exit(1);
}

console.log("✅ All required environment variables are present and valid.");
process.exit(0);
