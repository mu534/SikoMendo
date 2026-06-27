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
  firstName: z.string().min(1, "First name is required").trim(),
  lastName: z.string().min(1, "Last name is required").trim(),
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
  address: optionalString,
  department: optionalString,
  position: optionalString,
  hireDate: optionalDate,
  employmentStatus: z.enum(["ACTIVE", "ON_LEAVE", "RESIGNED", "RETIRED", "SUSPENDED", "TERMINATED", "INACTIVE"]),
  employmentType: optionalString,
  maritalStatus: optionalString,
  emergencyContactName: optionalString,
  emergencyContactPhone: optionalString,
  educationLevel: optionalString,
  fieldOfStudy: optionalString,
  institutionName: optionalString,
  graduationYear: optionalString,
  cooperativeId: optionalString,
  userId: optionalString,
});

export type EmployeeInput = z.infer<typeof employeeSchema>;

export function employeeFormDataToObject(formData: FormData) {
  return {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    gender: formData.get("gender"),
    dateOfBirth: formData.get("dateOfBirth"),
    address: formData.get("address"),
    department: formData.get("department"),
    position: formData.get("position"),
    hireDate: formData.get("hireDate"),
    employmentStatus: formData.get("employmentStatus"),
    employmentType: formData.get("employmentType"),
    maritalStatus: formData.get("maritalStatus"),
    emergencyContactName: formData.get("emergencyContactName"),
    emergencyContactPhone: formData.get("emergencyContactPhone"),
    educationLevel: formData.get("educationLevel"),
    fieldOfStudy: formData.get("fieldOfStudy"),
    institutionName: formData.get("institutionName"),
    graduationYear: formData.get("graduationYear"),
    cooperativeId: formData.get("cooperativeId"),
    userId: formData.get("userId"),
  };
}
