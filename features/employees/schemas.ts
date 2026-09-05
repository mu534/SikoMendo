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
    (v) => (v && String(v).trim() !== "" ? String(v).trim() : "ACTIVE"),
    z.enum(["ACTIVE", "ON_LEAVE", "RESIGNED", "RETIRED", "SUSPENDED", "TERMINATED", "INACTIVE"])
  ),
  employmentType: optionalEnum(["PERMANENT", "CONTRACT", "TEMPORARY", "PROBATION", "INTERNSHIP"]),
  educationLevel: optionalEnum(["PRIMARY", "SECONDARY", "CERTIFICATE", "DIPLOMA", "BACHELOR", "MASTER", "PHD"]),
  fieldOfStudy: optionalString,
  institutionName: optionalString,
  graduationYear: optionalString,
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
    educationLevel: s("educationLevel"),
    fieldOfStudy: s("fieldOfStudy"),
    institutionName: s("institutionName"),
    graduationYear: s("graduationYear"),
    userId: s("userId"),
    managerId: s("managerId"),
  };
}
