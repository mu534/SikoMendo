import { z } from "zod";

// ── Helpers for optional (contact section only) ───────────────────────────────
const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : null));

const optionalEmail = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : null))
  .pipe(z.string().email("Enter a valid email").nullable());

// ── Helpers for required fields ───────────────────────────────────────────────
const requiredString = (label: string) =>
  z
    .string({ required_error: `${label} is required` })
    .min(1, `${label} is required`)
    .trim();

const requiredDate = (label: string) =>
  z
    .string({ required_error: `${label} is required` })
    .min(1, `${label} is required`)
    .transform((v) => new Date(v))
    .pipe(z.date({ required_error: `${label} is required` }));

const requiredDecimal = (label: string) =>
  z
    .string({ required_error: `${label} is required` })
    .min(1, `${label} is required`)
    .transform((v) => parseFloat(v))
    .pipe(z.number({ required_error: `${label} is required` }).nonnegative("Must be 0 or greater"));

const requiredInt = (label: string) =>
  z
    .string({ required_error: `${label} is required` })
    .min(1, `${label} is required`)
    .transform((v) => parseInt(v, 10))
    .pipe(z.number({ required_error: `${label} is required` }).int().nonnegative("Must be 0 or greater"));

// ── Schema ────────────────────────────────────────────────────────────────────
export const cooperativeSchema = z
  .object({
    // Section 1 — Basic Information (all required except cooperativeType has a default)
    name: requiredString("Cooperative Name"),
    cooperativeType: requiredString("Cooperative Type"),
    registrationNumber: requiredString("Registration Number"),
    registrationDate: requiredDate("Registration Date"),
    dateJoinedUnion: requiredDate("Date Joined Union"),
    isActive: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),

    // Section 2 — Address (all required)
    district: requiredString("District"),
    kebele: requiredString("Kebele"),

    // Section 3 — Registration Details (all required)
    businessType: requiredString("Business Type"),
    registrationFee: requiredDecimal("Registration Fee"),
    numberOfShares: requiredInt("Number of Shares"),
    pricePerShare: requiredDecimal("Price Per Share"),

    // Section 4 — Membership (all required)
    totalMembers: requiredInt("Total Members"),
    maleMembers: requiredInt("Male Members"),
    femaleMembers: requiredInt("Female Members"),

    // Section 5 — Capital (all required)
    fixedAssets: requiredDecimal("Fixed Assets"),
    currentAssets: requiredDecimal("Current Assets"),

    // Section 6 — Contact & Additional (all optional)
    description: optionalString,
    location: optionalString,
    contactPerson: optionalString,
    contactEmail: optionalEmail,
    contactPhone: optionalString,
  })
  .superRefine((data, ctx) => {
    if (data.maleMembers + data.femaleMembers !== data.totalMembers) {
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
