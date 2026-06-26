import { z } from "zod";

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : null));

const optionalDecimal = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? parseFloat(v.trim()) : null))
  .pipe(z.number().nonnegative("Must be 0 or greater").nullable());

const optionalInt = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? parseInt(v.trim(), 10) : null))
  .pipe(z.number().int().nonnegative("Must be 0 or greater").nullable());

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? new Date(v.trim()) : null))
  .pipe(z.date().nullable());

export const cooperativeSchema = z
  .object({
    // Basic
    name: z.string().min(2, "Name must be at least 2 characters").trim(),
    cooperativeType: optionalString,
    registrationNumber: optionalString,
    registrationDate: optionalDate,
    dateJoinedUnion: optionalDate,
    isActive: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),

    // Address
    district: optionalString,
    kebele: optionalString,

    // Registration details
    businessType: optionalString,
    registrationFee: optionalDecimal,
    numberOfShares: optionalInt,
    pricePerShare: optionalDecimal,

    // Membership
    totalMembers: optionalInt,
    maleMembers: optionalInt,
    femaleMembers: optionalInt,

    // Capital
    fixedAssets: optionalDecimal,
    currentAssets: optionalDecimal,

    // Legacy fields kept for backward compat
    description: optionalString,
    location: optionalString,
    contactPerson: optionalString,
    contactEmail: z
      .string()
      .optional()
      .transform((v) => (v && v.trim() !== "" ? v.trim() : null))
      .pipe(z.string().email("Enter a valid email").nullable()),
    contactPhone: optionalString,
  })
  .superRefine((data, ctx) => {
    const { totalMembers, maleMembers, femaleMembers } = data;
    if (
      totalMembers !== null &&
      maleMembers !== null &&
      femaleMembers !== null &&
      maleMembers + femaleMembers !== totalMembers
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Male + Female members must equal Total members",
        path: ["totalMembers"],
      });
    }
  });

export type CooperativeInput = z.infer<typeof cooperativeSchema>;

export function cooperativeFormDataToObject(formData: FormData) {
  return {
    name: formData.get("name"),
    cooperativeType: formData.get("cooperativeType"),
    registrationNumber: formData.get("registrationNumber"),
    registrationDate: formData.get("registrationDate"),
    dateJoinedUnion: formData.get("dateJoinedUnion"),
    isActive: formData.get("isActive"),
    district: formData.get("district"),
    kebele: formData.get("kebele"),
    businessType: formData.get("businessType"),
    registrationFee: formData.get("registrationFee"),
    numberOfShares: formData.get("numberOfShares"),
    pricePerShare: formData.get("pricePerShare"),
    totalMembers: formData.get("totalMembers"),
    maleMembers: formData.get("maleMembers"),
    femaleMembers: formData.get("femaleMembers"),
    fixedAssets: formData.get("fixedAssets"),
    currentAssets: formData.get("currentAssets"),
    description: formData.get("description"),
    location: formData.get("location"),
    contactPerson: formData.get("contactPerson"),
    contactEmail: formData.get("contactEmail"),
    contactPhone: formData.get("contactPhone"),
  };
}
