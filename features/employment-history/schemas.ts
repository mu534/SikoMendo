import { z } from "zod";

export const employmentChangeSchema = z.object({
  departmentId: z.string().min(1, "Department is required"),
  positionId: z.string().min(1, "Position is required"),
  employmentType: z
    .union([z.enum(["PERMANENT", "CONTRACT", "TEMPORARY", "PROBATION", "INTERNSHIP"]), z.literal("")])
    .optional()
    .transform((v) => (v ? v : null)),
  effectiveDate: z.string().min(1, "Effective date is required"),
  changeReason: z.string().trim().min(1, "A reason for this change is required"),
  remarks: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : null)),
});

export type EmploymentChangeInput = z.infer<typeof employmentChangeSchema>;

export function employmentChangeFormDataToObject(formData: FormData) {
  return {
    departmentId: formData.get("departmentId"),
    positionId: formData.get("positionId"),
    employmentType: formData.get("employmentType"),
    effectiveDate: formData.get("effectiveDate"),
    changeReason: formData.get("changeReason"),
    remarks: formData.get("remarks"),
  };
}
