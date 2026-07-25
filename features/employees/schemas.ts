import { z } from "zod";

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : null));

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? new Date(v) : null));

export const employeeSchema = z.object({
  firstName: z.preprocess((v) => (v ? String(v).trim() : ""), z.string().min(1, "First name is required")),
  middleName: optionalString,
  lastName: z.preprocess((v) => (v ? String(v).trim() : ""), z.string().min(1, "Last name is required")),
  email: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : null))
    .pipe(z.string().email("Enter a valid email").nullable()),
  phone: optionalString,
  gender: z
    .union([z.enum(["MALE", "FEMALE"]), z.literal("")])
    .optional()
    .transform((v) => (v ? v : null)),
  dateOfBirth: optionalDate,
  maritalStatus: optionalString,
  address: optionalString,
  emergencyContactName: optionalString,
  emergencyContactPhone: optionalString,
  emergencyContactRelationship: optionalString,
  emergencyContactAddress: optionalString,
  department: optionalString,
  position: optionalString,
  hireDate: optionalDate,
  employmentStatus: z.preprocess(
    (v) => (v && String(v).trim() !== "" ? String(v).trim() : "ACTIVE"),
    z.enum(["ACTIVE", "ON_LEAVE", "RESIGNED", "RETIRED", "SUSPENDED", "TERMINATED", "INACTIVE"])
  ),
  employmentType: optionalString,
  educationLevel: optionalString,
  fieldOfStudy: optionalString,
  institutionName: optionalString,
  graduationYear: optionalString,
  cooperativeId: optionalString,
  userId: optionalString,
});

export type EmployeeInput = z.infer<typeof employeeSchema>;

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
    department: s("department"),
    position: s("position"),
    hireDate: s("hireDate"),
    employmentStatus: s("employmentStatus"),
    employmentType: s("employmentType"),
    educationLevel: s("educationLevel"),
    fieldOfStudy: s("fieldOfStudy"),
    institutionName: s("institutionName"),
    graduationYear: s("graduationYear"),
    cooperativeId: s("cooperativeId"),
    userId: s("userId"),
  };
}
