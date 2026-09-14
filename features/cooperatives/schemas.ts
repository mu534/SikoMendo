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

// ── Helpers for required fields (Zod v4 uses `error` not `required_error`) ───
const requiredString = (label: string) =>
  z.string().min(1, `${label} is required`).trim();

const requiredDate = (label: string) =>
  z
    .string()
    .min(1, `${label} is required`)
    .transform((v) => new Date(v))
    .pipe(z.date());

const requiredDecimal = (label: string) =>
  z
    .string()
    .min(1, `${label} is required`)
    .transform((v) => parseFloat(v))
    .pipe(z.number({ error: `${label} is required` }).nonnegative("Must be 0 or greater"));

const requiredInt = (label: string) =>
  z
    .string()
    .min(1, `${label} is required`)
    .transform((v) => parseInt(v, 10))
    .pipe(z.number({ error: `${label} is required` }).int().nonnegative("Must be 0 or greater"));

// ── Schema ────────────────────────────────────────────────────────────────────
export const cooperativeSchema = z
  .object({
    name: requiredString("Cooperative Name"),
    cooperativeType: requiredString("Cooperative Type"),
    registrationNumber: requiredString("Registration Number"),
    registrationDate: requiredDate("Registration Date"),
    dateJoinedUnion: requiredDate("Date Joined Union"),
    isActive: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),

    district: requiredString("District"),
    kebele: requiredString("Kebele"),

    businessType: requiredString("Business Type"),
    registrationFee: requiredDecimal("Registration Fee"),
    numberOfShares: requiredInt("Number of Shares"),
    pricePerShare: requiredDecimal("Price Per Share"),

    totalMembers: requiredInt("Total Members"),
    maleMembers: requiredInt("Male Members"),
    femaleMembers: requiredInt("Female Members"),

    fixedAssets: requiredDecimal("Fixed Assets"),
    currentAssets: requiredDecimal("Current Assets"),

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

// ── Legal certificate file validation ─────────────────────────────────────────

/** Allowed MIME types for the cooperative legal certificate. */
export const CERTIFICATE_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
] as const;

/** Allowed file extensions (lower-cased). */
export const CERTIFICATE_ALLOWED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png"] as const;

/** Maximum file size: 10 MB. */
export const CERTIFICATE_MAX_BYTES = 10 * 1024 * 1024;

export type CertificateAllowedMime = (typeof CERTIFICATE_ALLOWED_MIME_TYPES)[number];

/**
 * Validates a legal certificate File object server-side.
 * Returns null on success, or an error message string on failure.
 */
export function validateCertificateFile(file: File): string | null {
  if (!file || file.size === 0) {
    return "Legal certificate file is required.";
  }
  if (file.size > CERTIFICATE_MAX_BYTES) {
    return `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is 10 MB.`;
  }
  const mimeOk = (CERTIFICATE_ALLOWED_MIME_TYPES as readonly string[]).includes(file.type);
  if (!mimeOk) {
    return `Unsupported file type "${file.type}". Allowed formats: PDF, JPG, JPEG, PNG.`;
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const extOk = (CERTIFICATE_ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
  if (!extOk) {
    return `Unsupported file extension ".${ext}". Allowed extensions: .pdf, .jpg, .jpeg, .png.`;
  }
  return null;
}
