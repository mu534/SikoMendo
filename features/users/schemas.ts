import { z } from "zod";
import { ROLES } from "@/lib/permissions";

export const createUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  username: z
    .string()
    .min(2, "Username must be at least 2 characters")
    .max(40, "Username must be at most 40 characters")
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Username may only contain letters, numbers, dots, hyphens, and underscores"
    ),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(ROLES),
});

export const updateUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  username: z
    .string()
    .min(2, "Username must be at least 2 characters")
    .max(40, "Username must be at most 40 characters")
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Username may only contain letters, numbers, dots, hyphens, and underscores"
    ),
  role: z.enum(ROLES),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/**
 * Schema for creating a manager account (General Manager or Department Manager)
 * directly from the new-user page. The username is always derived server-side
 * from the employee's Employee ID — it is never supplied by the client.
 *
 * - role must be MANAGER or DEPT_MANAGER (not ADMIN, HR_OFFICER, or EMPLOYEE)
 * - departmentId is required when role=DEPT_MANAGER, optional otherwise
 */
export const createManagerAccountSchema = z.object({
  employeeId:   z.string().min(1, "Select an employee."),
  role:         z.enum(["MANAGER", "DEPT_MANAGER"]),
  departmentId: z.string().optional(),
});

export type CreateManagerAccountInput = z.infer<typeof createManagerAccountSchema>;
