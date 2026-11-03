import { z } from "zod";
import { ROLES } from "@/lib/permissions";
import { normalizeAnyPhone, isOldEnoughToRegister } from "@/features/employees/schemas";

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

// ── createManagerWithEmployeeSchema ──────────────────────────────────────────
//
// Validates the payload for creating a manager AND their employee record
// together in one transaction on the /users/new page.
//
// The username is derived server-side from the generated Employee ID — the
// client does NOT supply it.  educations, emergencyContact, and managerId are
// intentionally omitted: the GM has no superior (managerId = null at DB level);
// the DM's managerId is auto-wired to the GM's employee.id by the action.

const managerEmployeeBaseSchema = z.object({
  managerType: z.enum(["MANAGER", "DEPT_MANAGER"]),
  // Personal information
  firstName: z.preprocess(
    (v) => (v ? String(v).trim() : ""),
    z.string().min(1, "First name is required").max(100)
  ),
  middleName: z.preprocess(
    (v) => (v ? String(v).trim() : ""),
    z.string().min(1, "Father's name is required").max(100)
  ),
  lastName: z.preprocess(
    (v) => (v ? String(v).trim() : ""),
    z.string().min(1, "Grandfather's name is required").max(100)
  ),
  phone: z.preprocess(
    (v) => (v ? String(v).trim() : ""),
    z.string().min(1, "Phone is required")
  ).transform((v) => normalizeAnyPhone(v) ?? v),
  email: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : null))
    .pipe(z.string().email("Enter a valid email").nullable()),
  gender: z.preprocess(
    (v) => (v ? String(v).trim() : ""),
    z.enum(["MALE", "FEMALE"], { error: "Gender is required" })
  ),
  dateOfBirth: z.preprocess(
    (v) => (v && String(v).trim() !== "" ? new Date(String(v)) : null),
    z
      .date({ error: "Date of birth is required" })
      .nullable()
      .refine((d) => d !== null, "Date of birth is required")
      .refine((d) => d === null || d <= new Date(), "Date of birth cannot be in the future")
      .refine(
        (d) => d === null || isOldEnoughToRegister(d),
        "Employee must be older than 20 years"
      )
  ),
  maritalStatus: z.preprocess(
    (v) => (v ? String(v).trim() : ""),
    z.enum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED", "OTHER"], {
      error: "Marital status is required",
    })
  ),
  // Employment information
  hireDate: z.preprocess(
    (v) => (v && String(v).trim() !== "" ? new Date(String(v)) : null),
    z
      .date({ error: "Hire date is required" })
      .nullable()
      .refine((d) => d !== null, "Hire date is required")
  ),
  employmentType: z.preprocess(
    (v) => (v ? String(v).trim() : ""),
    z.enum(["PERMANENT", "CONTRACT", "TEMPORARY", "PROBATION", "INTERNSHIP"], {
      error: "Employment type is required",
    })
  ),
  positionId: z.preprocess(
    (v) => (v ? String(v).trim() : ""),
    z.string().min(1, "Position is required")
  ),
});

export const createManagerWithEmployeeSchema = z.discriminatedUnion("managerType", [
  // General Manager variant — no department required
  managerEmployeeBaseSchema.extend({
    managerType: z.literal("MANAGER"),
  }),
  // Department Manager variant — departmentId is required
  managerEmployeeBaseSchema.extend({
    managerType: z.literal("DEPT_MANAGER"),
    departmentId: z.preprocess(
      (v) => (v ? String(v).trim() : ""),
      z.string().min(1, "Department is required")
    ),
  }),
]);

export type CreateManagerWithEmployeeInput = z.infer<typeof createManagerWithEmployeeSchema>;
