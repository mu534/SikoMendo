import { z } from "zod";

export const positionSchema = z.object({
  name: z.string().trim().min(1, "Position name is required"),
  departmentId: z.string().min(1, "Department is required"),
  description: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : null)),
  isActive: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

export type PositionInput = z.infer<typeof positionSchema>;

export function positionFormDataToObject(formData: FormData) {
  return {
    name: formData.get("name"),
    departmentId: formData.get("departmentId"),
    description: formData.get("description"),
    isActive: formData.get("isActive"),
  };
}
