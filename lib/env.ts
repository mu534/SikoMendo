import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL must be a valid URL"),
  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL must be a valid URL"),
  CLOUDINARY_CLOUD_NAME: z.string().min(1, "CLOUDINARY_CLOUD_NAME is required"),
  CLOUDINARY_API_KEY: z.string().min(1, "CLOUDINARY_API_KEY is required"),
  CLOUDINARY_API_SECRET: z.string().min(1, "CLOUDINARY_API_SECRET is required"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

let parsedEnv: Env;

// Server: validate the full environment. Client: only NEXT_PUBLIC_* values exist in the bundle.
if (typeof window === "undefined") {
  try {
    parsedEnv = envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Invalid environment variables:");
      console.error(JSON.stringify(error.format(), null, 2));
    } else {
      console.error("❌ Failed to parse environment variables:", error);
    }
    throw new Error("Invalid environment variables. Check your .env.local file against .env.example.");
  }
} else {
  parsedEnv = {
    DATABASE_URL: "",
    BETTER_AUTH_SECRET: "",
    BETTER_AUTH_URL: "",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    CLOUDINARY_CLOUD_NAME: "",
    CLOUDINARY_API_KEY: "",
    CLOUDINARY_API_SECRET: "",
    NODE_ENV: (process.env.NODE_ENV as Env["NODE_ENV"]) || "development",
  };
}

export const env = parsedEnv;
