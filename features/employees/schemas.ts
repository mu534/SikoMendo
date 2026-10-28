import { z } from "zod";
import {
  normalizeEthiopianPhone,
  normalizeInternationalPhone,
} from "@/lib/phone-et";

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

// ── Emergency Contact constants ────────────────────────────────────────────

/**
 * Accepts any phone number that can be either:
 *   (a) normalized as an Ethiopian mobile number (+251 9X/7X XXXXXXX), or
 *   (b) a valid international number starting with + (E.164).
 * Returns the normalized string, or null on failure.
 */
export function normalizeAnyPhone(raw: string): string | null {
  const ethNorm = normalizeEthiopianPhone(raw);
  if (ethNorm) return ethNorm;
  return normalizeInternationalPhone(raw);
}

/** Zod refine helper — accepts Ethiopian mobile or valid international format. */
function isValidPhoneInput(v: string): boolean {
  return normalizeAnyPhone(v) !== null;
}

export const EMERGENCY_CONTACT_RELATIONSHIPS = [
  "Spouse",
  "Father",
  "Mother",
  "Brother",
  "Sister",
  "Son",
  "Daughter",
  "Guardian",
  "Other Relative",
  "Friend",
  "Other",
] as const;

export type EmergencyContactRelationship =
  (typeof EMERGENCY_CONTACT_RELATIONSHIPS)[number];

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

/**
 * Returns true when the given birth date is at least 21 full years before
 * today — i.e. the employee is strictly older than 20.
 *
 * Age is calculated by comparing calendar year/month/day, not milliseconds,
 * to avoid leap-year and UTC-offset edge cases.
 *
 * Examples (today = 2026-10-28):
 *   Born 2005-10-28 → exactly 21 today → Accept
 *   Born 2005-10-29 → turns 21 tomorrow → Reject
 *   Born 2005-10-27 → turned 21 yesterday → Accept
 *   Born 2006-01-01 → only 20 → Reject
 */
export function isOldEnoughToRegister(dob: Date): boolean {
  const today = new Date();
  // Threshold: same calendar date 21 years ago.
  const threshold = new Date(
    today.getFullYear() - 21,
    today.getMonth(),
    today.getDate()
  );
  // dob must be on or before the threshold (i.e. person has reached their
  // 21st birthday today or already had it in the past).
  return dob <= threshold;
}

const MIN_AGE_YEARS = 21; // "strictly older than 20"

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 1950;


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

    // ── All other levels: fieldOfStudy is mandatory ──────────────────────────
    if (!isHsLevel && !data.fieldOfStudy) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fieldOfStudy"],
        message: "Field of Study is required.",
      });
    }

    // Institution type is always required
    if (!data.institutionType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["institutionType"],
        message: "Institution type is required.",
      });
    }

    // Institution name is always required
    if (!data.institutionName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["institutionName"],
        message: "Institution name is required.",
      });
    }

    // Qualification status is always required
    if (!data.qualificationStatus) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["qualificationStatus"],
        message: "Qualification status is required.",
      });
    }

    // Graduation year is always required
    if (data.graduationYear === null || data.graduationYear === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["graduationYear"],
        message: "Graduation year is required.",
      });
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

  });

export type EducationRecordInput = z.infer<typeof educationRecordSchema>;

// ── Main employee schema ───────────────────────────────────────────────────

export const employeeSchema = z.object({
  firstName: z.preprocess(
    (v) => (v ? String(v).trim() : ""),
    z.string()
      .min(1, "First name is required")
      .max(100, "First name must be 100 characters or fewer")
  ),
  // In Ethiopia, the naming convention is given name + father's name + grandfather's name.
  // All three parts are required on official documents.
  middleName: z.preprocess(
    (v) => (v ? String(v).trim() : ""),
    z.string()
      .min(1, "Father's name is required")
      .max(100, "Father's name must be 100 characters or fewer")
  ),
  lastName: z.preprocess(
    (v) => (v ? String(v).trim() : ""),
    z.string()
      .min(1, "Grandfather's name is required")
      .max(100, "Grandfather's name must be 100 characters or fewer")
  ),
  email: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : null))
    .pipe(z.string().email("Enter a valid email").nullable()),
  phone: z.preprocess(
    (v) => (v ? String(v).trim() : ""),
    z.string()
      .min(1, "Phone number is required")
      .refine(isValidPhoneInput, "Enter a valid phone number (e.g. +251 911 234567 or +44 7911 123456)")
  ).transform((v) => normalizeAnyPhone(String(v).trim()) ?? String(v).trim()),
  gender: z.preprocess((v) => (v ? String(v).trim() : ""), z.enum(["MALE", "FEMALE"], { error: "Gender is required" })),
  dateOfBirth: z.preprocess(
    (v) => (v && String(v).trim() !== "" ? new Date(String(v)) : null),
    z.date({ error: "Date of birth is required" })
      .nullable()
      .refine((d) => d !== null, "Date of birth is required")
      .refine(
        (d) => d === null || d <= new Date(),
        "Date of birth cannot be in the future"
      )
      .refine(
        (d) => d === null || isOldEnoughToRegister(d),
        `Employee must be older than ${MIN_AGE_YEARS - 1} years to register`
      )
  ),
  maritalStatus: z.preprocess(
    (v) => (v ? String(v).trim() : ""),
    z.enum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED", "OTHER"], { error: "Marital status is required" })
  ),
  address: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : null))
    .pipe(z.string().max(300, "Address must be 300 characters or fewer").nullable()),
  emergencyContactName: z.preprocess(
    (v) => (v ? String(v).trim() : ""),
    z.string()
      .min(1, "Emergency contact name is required")
      .max(100, "Name must be 100 characters or fewer")
  ),
  emergencyContactPhone: z.preprocess(
    (v) => (v ? String(v).trim() : ""),
    z.string()
      .min(1, "Emergency contact phone is required")
      .refine(isValidPhoneInput, "Enter a valid phone number (e.g. +251 911 234567 or +44 7911 123456)")
  ).transform((v) => normalizeAnyPhone(String(v).trim()) ?? String(v).trim()),
  // emergencyContactRelationship stores the final resolved string:
  //   - a named relationship ("Spouse", "Father", etc.) for the standard options
  //   - the custom text the user typed when "Other" was selected
  // The form submits the hidden field name "emergencyContactRelationship" with this
  // resolved value — the "OTHER" sentinel is never persisted.
  emergencyContactRelationship: z.preprocess(
    (v) => (v ? String(v).trim() : ""),
    z.string()
      .min(1, "Relationship is required")
      .max(100, "Relationship must be 100 characters or fewer")
  ),
  emergencyContactAddress: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : null))
    .pipe(z.string().max(200, "Address must be 200 characters or fewer").nullable()),
  departmentId: z.preprocess((v) => (v ? String(v).trim() : ""), z.string().min(1, "Department is required")),
  positionId: z.preprocess((v) => (v ? String(v).trim() : ""), z.string().min(1, "Position is required")),
  hireDate: z.preprocess(
    (v) => (v && String(v).trim() !== "" ? new Date(String(v)) : null),
    z.date({ error: "Hire date is required" }).nullable().refine((d) => d !== null, "Hire date is required")
  ),
  employmentStatus: z.preprocess(
    (v) => (v && String(v).trim() !== "" ? String(v).trim() : "ONBOARDING"),
    z.enum(["ONBOARDING", "ACTIVE", "ON_LEAVE", "RESIGNED", "RETIRED", "SUSPENDED", "TERMINATED", "INACTIVE"])
  ),
  employmentType: z.preprocess(
    (v) => (v ? String(v).trim() : ""),
    z.enum(["PERMANENT", "CONTRACT", "TEMPORARY", "PROBATION", "INTERNSHIP"], { error: "Employment type is required" })
  ),
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
    .pipe(z.array(educationRecordSchema).min(1, "At least one education record is required")),
  userId: optionalString,
  managerId: z.preprocess((v) => (v ? String(v).trim() : ""), z.string().min(1, "Manager (Reports To) is required")),
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
