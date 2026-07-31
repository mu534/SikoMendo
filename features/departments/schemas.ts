import { z } from "zod";

// Department names are fixed at seed time and never edited through the app —
// only description and active status are editable, by Admins only.
export const departmentUpdateSchema = z.object({
  description: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : null)),
  isActive: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

export type DepartmentUpdateInput = z.infer<typeof departmentUpdateSchema>;

export function departmentFormDataToObject(formData: FormData) {
  return {
    description: formData.get("description"),
    isActive: formData.get("isActive"),
  };
}
