import { z } from "zod";

export const CONTRACT_TYPES = ["PERMANENT", "CONTRACT", "TEMPORARY", "PROBATION", "INTERNSHIP"] as const;

export const contractSchema = z
  .object({
    contractType: z.enum(CONTRACT_TYPES, { message: "Select a contract type." }),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z
      .string()
      .optional()
      .transform((v) => (v && v.trim() !== "" ? v.trim() : null)),
    remarks: z
      .string()
      .optional()
      .transform((v) => (v && v.trim() !== "" ? v.trim() : null)),
  })
  .refine((d) => !d.endDate || new Date(`${d.endDate}T00:00:00Z`) > new Date(`${d.startDate}T00:00:00Z`), {
    message: "End date must be after the start date.",
    path: ["endDate"],
  });

export type ContractInput = z.infer<typeof contractSchema>;

export function contractFormDataToObject(formData: FormData) {
  return {
    contractType: formData.get("contractType"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    remarks: formData.get("remarks"),
  };
}
