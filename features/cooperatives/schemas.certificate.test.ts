import { describe, it, expect } from "vitest";
import {
  validateCertificateFile,
  CERTIFICATE_MAX_BYTES,
  CERTIFICATE_ALLOWED_MIME_TYPES,
  CERTIFICATE_ALLOWED_EXTENSIONS,
} from "./schemas";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal File-like object that satisfies validateCertificateFile's checks. */
function makeFile(name: string, type: string, size: number): File {
  // File constructor: new File(parts, name, options)
  const blob = new Blob(["x".repeat(Math.max(1, size))], { type });
  return new File([blob], name, { type });
}

// ── Constants ─────────────────────────────────────────────────────────────────

describe("certificate constants", () => {
  it("CERTIFICATE_MAX_BYTES is 10 MB", () => {
    expect(CERTIFICATE_MAX_BYTES).toBe(10 * 1024 * 1024);
  });

  it("allowed MIME types include pdf, jpeg, jpg, png", () => {
    expect(CERTIFICATE_ALLOWED_MIME_TYPES).toContain("application/pdf");
    expect(CERTIFICATE_ALLOWED_MIME_TYPES).toContain("image/jpeg");
    expect(CERTIFICATE_ALLOWED_MIME_TYPES).toContain("image/jpg");
    expect(CERTIFICATE_ALLOWED_MIME_TYPES).toContain("image/png");
  });

  it("allowed extensions include pdf, jpg, jpeg, png", () => {
    expect(CERTIFICATE_ALLOWED_EXTENSIONS).toContain("pdf");
    expect(CERTIFICATE_ALLOWED_EXTENSIONS).toContain("jpg");
    expect(CERTIFICATE_ALLOWED_EXTENSIONS).toContain("jpeg");
    expect(CERTIFICATE_ALLOWED_EXTENSIONS).toContain("png");
  });
});

// ── validateCertificateFile ───────────────────────────────────────────────────

describe("validateCertificateFile — valid files", () => {
  it("accepts a valid PDF file", () => {
    const file = makeFile("certificate.pdf", "application/pdf", 1024);
    expect(validateCertificateFile(file)).toBeNull();
  });

  it("accepts a valid JPEG file", () => {
    const file = makeFile("cert.jpeg", "image/jpeg", 2048);
    expect(validateCertificateFile(file)).toBeNull();
  });

  it("accepts a valid JPG file", () => {
    const file = makeFile("cert.jpg", "image/jpeg", 512);
    expect(validateCertificateFile(file)).toBeNull();
  });

  it("accepts a valid PNG file", () => {
    const file = makeFile("cert.png", "image/png", 4096);
    expect(validateCertificateFile(file)).toBeNull();
  });

  it("accepts a file exactly at the size limit", () => {
    const file = makeFile("cert.pdf", "application/pdf", CERTIFICATE_MAX_BYTES);
    expect(validateCertificateFile(file)).toBeNull();
  });
});

describe("validateCertificateFile — invalid files", () => {
  it("rejects a file that is one byte over the size limit", () => {
    const file = makeFile("big.pdf", "application/pdf", CERTIFICATE_MAX_BYTES + 1);
    const err = validateCertificateFile(file);
    expect(err).not.toBeNull();
    expect(err).toMatch(/too large/i);
  });

  it("rejects a DOCX file (invalid MIME type)", () => {
    const file = makeFile(
      "cert.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      1024
    );
    const err = validateCertificateFile(file);
    expect(err).not.toBeNull();
    expect(err).toMatch(/unsupported file type/i);
  });

  it("rejects a GIF file (invalid MIME type)", () => {
    const file = makeFile("cert.gif", "image/gif", 1024);
    const err = validateCertificateFile(file);
    expect(err).not.toBeNull();
    expect(err).toMatch(/unsupported file type/i);
  });

  it("rejects a file with a disallowed extension even if MIME is blank", () => {
    const file = makeFile("cert.exe", "application/pdf", 512);
    const err = validateCertificateFile(file);
    // Extension .exe is not in allowlist — must be rejected
    expect(err).not.toBeNull();
    expect(err).toMatch(/unsupported file extension/i);
  });

  it("rejects a zero-byte file", () => {
    // size=0 triggers the empty-file check
    const file = new File([], "empty.pdf", { type: "application/pdf" });
    const err = validateCertificateFile(file);
    expect(err).not.toBeNull();
    expect(err).toMatch(/required/i);
  });
});

// ── cooperativeSchema — all existing validations still pass ──────────────────

import { cooperativeSchema } from "./schemas";

const validBase = {
  name: "Bale Robe Farmers Cooperative",
  cooperativeType: "Agricultural",
  registrationNumber: "REG-001",
  registrationDate: "2020-01-15",
  dateJoinedUnion: "2020-02-01",
  isActive: "true",
  district: "Bale",
  kebele: "01",
  businessType: "Farming supplies",
  registrationFee: "500",
  numberOfShares: "100",
  pricePerShare: "50",
  totalMembers: "10",
  maleMembers: "6",
  femaleMembers: "4",
  fixedAssets: "1000",
  currentAssets: "500",
};

describe("cooperativeSchema — existing validations preserved", () => {
  it("accepts a valid cooperative where member counts add up", () => {
    expect(cooperativeSchema.safeParse(validBase).success).toBe(true);
  });

  it("rejects when male + female members don't equal total members", () => {
    const result = cooperativeSchema.safeParse({ ...validBase, totalMembers: "11" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "totalMembers");
      expect(issue?.message).toMatch(/Male \+ Female members must equal Total members/);
    }
  });

  it("rejects a negative share count", () => {
    expect(cooperativeSchema.safeParse({ ...validBase, numberOfShares: "-5" }).success).toBe(false);
  });

  it("rejects when name is missing", () => {
    const without = { ...validBase } as Record<string, unknown>;
    delete without.name;
    expect(cooperativeSchema.safeParse(without).success).toBe(false);
  });

  it("rejects when district is missing", () => {
    const without = { ...validBase } as Record<string, unknown>;
    delete without.district;
    expect(cooperativeSchema.safeParse(without).success).toBe(false);
  });

  it("accepts optional fields being absent", () => {
    // description, location, contactPerson etc. are all optional
    const result = cooperativeSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it("rejects an invalid contact email", () => {
    const result = cooperativeSchema.safeParse({
      ...validBase,
      contactEmail: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid contact email", () => {
    const result = cooperativeSchema.safeParse({
      ...validBase,
      contactEmail: "info@bale.coop",
    });
    expect(result.success).toBe(true);
  });
});
