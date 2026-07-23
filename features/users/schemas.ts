import { z } from "zod";
import { ROLES } from "@/lib/permissions";

export const createUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(40, "Username must be at most 40 characters")
    .regex(/^[a-z0-9._-]+$/, "Username may only contain lowercase letters, numbers, dots, hyphens, and underscores"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(ROLES),
});

export const updateUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(40, "Username must be at most 40 characters")
    .regex(/^[a-z0-9._-]+$/, "Username may only contain lowercase letters, numbers, dots, hyphens, and underscores"),
  role: z.enum(ROLES),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
