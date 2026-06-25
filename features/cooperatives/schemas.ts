import { z } from "zod";

// Same null-vs-undefined reasoning as features/employees/schemas.ts:
// blank optional fields transform to `null` so clearing them on edit
// actually clears them in Prisma's `update`, not a no-op.
const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : null));

export const cooperativeSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").trim(),
  description: optionalString,
  location: optionalString,
  contactPerson: optionalString,
  contactEmail: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : null))
    .pipe(z.string().email("Enter a valid email").nullable()),
  contactPhone: optionalString,
  isActive: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

export type CooperativeInput = z.infer<typeof cooperativeSchema>;

export function cooperativeFormDataToObject(formData: FormData) {
  return {
    name: formData.get("name"),
    description: formData.get("description"),
    location: formData.get("location"),
    contactPerson: formData.get("contactPerson"),
    contactEmail: formData.get("contactEmail"),
    contactPhone: formData.get("contactPhone"),
    isActive: formData.get("isActive"),
  };
}
