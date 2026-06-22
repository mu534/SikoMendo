import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL must be a valid URL"),
  CLOUDINARY_CLOUD_NAME: z.string().min(1, "CLOUDINARY_CLOUD_NAME is required"),
  CLOUDINARY_API_KEY: z.string().min(1, "CLOUDINARY_API_KEY is required"),
  CLOUDINARY_API_SECRET: z.string().min(1, "CLOUDINARY_API_SECRET is required"),
  R2_ACCESS_KEY_ID: z.string().min(1, "R2_ACCESS_KEY_ID is required"),
  R2_SECRET_ACCESS_KEY: z.string().min(1, "R2_SECRET_ACCESS_KEY is required"),
  R2_ENDPOINT: z.string().min(1, "R2_ENDPOINT is required"),
  R2_BUCKET_NAME: z.string().min(1, "R2_BUCKET_NAME is required"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

// For Next.js client-side safety, we validate env variables only when run on the server
let parsedEnv: z.infer<typeof envSchema>;

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
    throw new Error("Invalid environment variables");
  }
} else {
  // Client side gets standard process.env values if prefix is NEXT_PUBLIC_
  const nodeEnv = (process.env.NODE_ENV as "development" | "production" | "test" | undefined) || "development";

  parsedEnv = {
    DATABASE_URL: "",
    BETTER_AUTH_SECRET: "",
    BETTER_AUTH_URL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    CLOUDINARY_CLOUD_NAME: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "",
    CLOUDINARY_API_KEY: "",
    CLOUDINARY_API_SECRET: "",
    R2_ACCESS_KEY_ID: "",
    R2_SECRET_ACCESS_KEY: "",
    R2_ENDPOINT: "",
    R2_BUCKET_NAME: "",
    NODE_ENV: nodeEnv,
  };
}

export const env = parsedEnv;
export type Env = z.infer<typeof envSchema>;
