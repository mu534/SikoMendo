import { z } from "zod";

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : null));

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? new Date(v) : null));

function optionalEnum<T extends [string, ...string[]]>(values: T) {
  return z
    .union([z.enum(values), z.literal("")])
    .optional()
    .transform((v) => (v ? v : null));
}

// ── Education constants ────────────────────────────────────────────────────
//
// PRIMARY and SECONDARY are retained in the DB enum for legacy data but are
// not offered as new choices in the form — HIGH_SCHOOL covers both.

export const EDUCATION_LEVELS = [
  "HIGH_SCHOOL",
  "CERTIFICATE",
  "DIPLOMA",
  "BACHELOR",
  "MASTER",
  "PHD",
  "OTHER",
] as const;

// All values the DB enum can store (superset of form-offered values).
export const ALL_EDUCATION_LEVELS = [
  "PRIMARY",
  "SECONDARY",
  "HIGH_SCHOOL",
  "CERTIFICATE",
  "DIPLOMA",
  "BACHELOR",
  "MASTER",
  "PHD",
  "OTHER",
] as const;

export const INSTITUTION_TYPES = [
  "HIGH_SCHOOL",
  "UNIVERSITY",
  "COLLEGE",
  "TVET",
  "OTHER",
] as const;

export const QUALIFICATION_STATUSES = ["IN_PROGRESS", "COMPLETED"] as const;

// Which institution types are compatible with each education level.
// Used by the form for conditional rendering AND by server-side validation.
export const COMPATIBLE_INSTITUTION_TYPES: Record<
  (typeof ALL_EDUCATION_LEVELS)[number],
  (typeof INSTITUTION_TYPES)[number][]
> = {
  PRIMARY:     ["HIGH_SCHOOL", "OTHER"],
  SECONDARY:   ["HIGH_SCHOOL", "OTHER"],
  HIGH_SCHOOL: ["HIGH_SCHOOL", "OTHER"],
  CERTIFICATE: ["TVET", "COLLEGE", "OTHER"],
  DIPLOMA:     ["TVET", "COLLEGE", "UNIVERSITY", "OTHER"],
  BACHELOR:    ["UNIVERSITY", "COLLEGE", "OTHER"],
  MASTER:      ["UNIVERSITY", "OTHER"],
  PHD:         ["UNIVERSITY", "OTHER"],
  OTHER:       ["HIGH_SCHOOL", "UNIVERSITY", "COLLEGE", "TVET", "OTHER"],
};

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 1950;

/** Valid Field of Study values when Education Level is High School. */
export const HIGH_SCHOOL_FIELDS_OF_STUDY = ["Natural Science", "Social Science"] as const;
export type HighSchoolFieldOfStudy = (typeof HIGH_SCHOOL_FIELDS_OF_STUDY)[number];

// ── Per-qualification Zod schema ───────────────────────────────────────────

export const educationRecordSchema = z
  .object({
    educationLevel: z.enum(ALL_EDUCATION_LEVELS, {
      error: "Select a valid education level.",
    }),
    fieldOfStudy: optionalString,
    institutionType: optionalEnum([...INSTITUTION_TYPES]),
    institutionName: optionalString,
    graduationYear: z
      .union([z.string(), z.number(), z.null(), z.undefined()])
      .optional()
      .transform((v) => {
        if (v === null || v === undefined) return null;
        const s = String(v).trim();
        if (s === "") return null;
        const n = parseInt(s, 10);
        return isNaN(n) ? null : n;
      })
      .pipe(
        z
          .number()
          .int("Graduation year must be a whole number.")
          .min(MIN_YEAR, `Graduation year must be ${MIN_YEAR} or later.`)
          .max(CURRENT_YEAR + 10, "Graduation year is too far in the future.")
          .nullable()
      ),
    qualificationStatus: optionalEnum([...QUALIFICATION_STATUSES]),
  })
  .superRefine((data, ctx) => {
    const lvl = data.educationLevel as (typeof ALL_EDUCATION_LEVELS)[number];
    const isHsLevel =
      lvl === "HIGH_SCHOOL" || lvl === "PRIMARY" || lvl === "SECONDARY";

    // ── High School: fieldOfStudy must be one of the two valid streams ──────
    if (isHsLevel) {
      if (!data.fieldOfStudy) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fieldOfStudy"],
          message: "Select a stream (Natural Science or Social Science) for High School.",
        });
      } else if (
        !(HIGH_SCHOOL_FIELDS_OF_STUDY as readonly string[]).includes(data.fieldOfStudy)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fieldOfStudy"],
          message: `"${data.fieldOfStudy}" is not a valid stream. Choose Natural Science or Social Science.`,
        });
      }
    }

    // Institution type must be compatible with education level (when provided)
    if (data.institutionType) {
      const compatible = COMPATIBLE_INSTITUTION_TYPES[lvl] ?? [];
      if (!compatible.includes(data.institutionType as (typeof INSTITUTION_TYPES)[number])) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["institutionType"],
          message: `"${data.institutionType}" is not a valid institution type for ${lvl.replace(/_/g, " ").toLowerCase()}.`,
        });
      }
    }

    // Completed qualifications: year must not be in the future
    if (
      data.qualificationStatus === "COMPLETED" &&
      data.graduationYear != null &&
      data.graduationYear > CURRENT_YEAR
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["graduationYear"],
        message: "Graduation year cannot be in the future for a completed qualification.",
      });
    }

    // Completed qualifications with a known institution type: institution name required
    if (
      data.qualificationStatus === "COMPLETED" &&
      data.institutionType &&
      !data.institutionName
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["institutionName"],
        message: "Institution name is required for a completed qualification.",
      });
    }
  });

export type EducationRecordInput = z.infer<typeof educationRecordSchema>;

// ── Main employee schema ───────────────────────────────────────────────────

export const employeeSchema = z.object({
  firstName: z.preprocess((v) => (v ? String(v).trim() : ""), z.string().min(1, "First name is required")),
  // In Ethiopia, the naming convention is given name + father's name + grandfather's name.
  // All three parts are required on official documents.
  middleName: z.preprocess((v) => (v ? String(v).trim() : ""), z.string().min(1, "Father's name is required")),
  lastName: z.preprocess((v) => (v ? String(v).trim() : ""), z.string().min(1, "Grandfather's name is required")),
  email: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : null))
    .pipe(z.string().email("Enter a valid email").nullable()),
  phone: optionalString,
  gender: optionalEnum(["MALE", "FEMALE"]),
  dateOfBirth: optionalDate,
  maritalStatus: optionalEnum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"]),
  address: optionalString,
  emergencyContactName: optionalString,
  emergencyContactPhone: optionalString,
  emergencyContactRelationship: optionalString,
  emergencyContactAddress: optionalString,
  departmentId: z.preprocess((v) => (v ? String(v).trim() : ""), z.string().min(1, "Department is required")),
  positionId: z.preprocess((v) => (v ? String(v).trim() : ""), z.string().min(1, "Position is required")),
  hireDate: optionalDate,
  employmentStatus: z.preprocess(
    (v) => (v && String(v).trim() !== "" ? String(v).trim() : "ONBOARDING"),
    z.enum(["ONBOARDING", "ACTIVE", "ON_LEAVE", "RESIGNED", "RETIRED", "SUSPENDED", "TERMINATED", "INACTIVE"])
  ),
  employmentType: optionalEnum(["PERMANENT", "CONTRACT", "TEMPORARY", "PROBATION", "INTERNSHIP"]),
  // educations is a JSON string produced by the form (FormData cannot carry nested arrays natively)
  educations: z
    .union([z.string(), z.array(z.unknown()), z.null(), z.undefined()])
    .optional()
    .transform((v) => {
      if (v === null || v === undefined) return [];
      if (Array.isArray(v)) return v;
      const s = String(v).trim();
      if (s === "" || s === "[]") return [];
      try {
        const parsed = JSON.parse(s);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })
    .pipe(z.array(educationRecordSchema)),
  userId: optionalString,
  managerId: optionalString,
});

export type EmployeeInput = z.infer<typeof employeeSchema>;

// Department/position/employmentType are intentionally excluded from updates —
// per the Employment History requirement, those only ever change through
// recordEmploymentChange(), never a direct edit, so "current" info always
// reflects the latest active history record.
export const employeeUpdateSchema = employeeSchema.omit({
  departmentId: true,
  positionId: true,
  employmentType: true,
});

export type EmployeeUpdateInput = z.infer<typeof employeeUpdateSchema>;

export function employeeUpdateFormDataToObject(formData: FormData) {
  const { departmentId: _d, positionId: _p, employmentType: _e, ...rest } = employeeFormDataToObject(formData);
  return rest;
}

export function employeeFormDataToObject(formData: FormData) {
  // formData.get() returns null for missing fields; Zod z.string() rejects null.
  // Wrap every value so missing fields become "" instead of null.
  const s = (key: string) => formData.get(key) ?? "";
  return {
    firstName: s("firstName"),
    middleName: s("middleName"),
    lastName: s("lastName"),
    email: s("email"),
    phone: s("phone"),
    gender: s("gender"),
    dateOfBirth: s("dateOfBirth"),
    maritalStatus: s("maritalStatus"),
    address: s("address"),
    emergencyContactName: s("emergencyContactName"),
    emergencyContactPhone: s("emergencyContactPhone"),
    emergencyContactRelationship: s("emergencyContactRelationship"),
    emergencyContactAddress: s("emergencyContactAddress"),
    departmentId: s("departmentId"),
    positionId: s("positionId"),
    hireDate: s("hireDate"),
    employmentStatus: s("employmentStatus"),
    employmentType: s("employmentType"),
    // educations is a JSON string produced by the form
    educations: s("educations"),
    userId: s("userId"),
    managerId: s("managerId"),
  };
}
