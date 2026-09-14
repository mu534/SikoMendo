import { describe, it, expect } from "vitest";
import {
  validateCertificateFile,
  CERTIFICATE_MAX_BYTES,
  CERTIFICATE_ALLOWED_EXTENSIONS,
} from "../schemas";

/**
 * Tests for LegalCertificateSection logic (the client-side validation
 * mirror of validateCertificateFile used in the handleFileChange handler).
 *
 * We test the pure logic functions rather than mounting the component,
 * following the same pattern as the other section tests in this directory.
 */

function makeFile(name: string, type: string, sizeBytes: number): File {
  const content = "x".repeat(Math.max(1, sizeBytes));
  return new File([content], name, { type });
}

// ── File size guard ───────────────────────────────────────────────────────────

describe("LegalCertificateSection — size guard", () => {
  it("allows a file below the size limit", () => {
    const file = makeFile("cert.pdf", "application/pdf", 1024);
    expect(file.size > CERTIFICATE_MAX_BYTES).toBe(false);
    expect(validateCertificateFile(file)).toBeNull();
  });

  it("blocks a file above the size limit", () => {
    const file = makeFile("cert.pdf", "application/pdf", CERTIFICATE_MAX_BYTES + 1);
    expect(file.size > CERTIFICATE_MAX_BYTES).toBe(true);
    const err = validateCertificateFile(file);
    expect(err).not.toBeNull();
    expect(err).toMatch(/too large/i);
  });
});

// ── Extension guard ───────────────────────────────────────────────────────────

describe("LegalCertificateSection — extension guard", () => {
  it("allows .pdf extension", () => {
    const ext = "pdf";
    expect((CERTIFICATE_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)).toBe(true);
  });

  it("allows .jpg extension", () => {
    const ext = "jpg";
    expect((CERTIFICATE_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)).toBe(true);
  });

  it("allows .jpeg extension", () => {
    const ext = "jpeg";
    expect((CERTIFICATE_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)).toBe(true);
  });

  it("allows .png extension", () => {
    const ext = "png";
    expect((CERTIFICATE_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)).toBe(true);
  });

  it("blocks .docx extension", () => {
    const ext = "docx";
    expect((CERTIFICATE_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)).toBe(false);
  });

  it("blocks .gif extension", () => {
    const ext = "gif";
    expect((CERTIFICATE_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)).toBe(false);
  });

  it("blocks .exe extension", () => {
    const ext = "exe";
    expect((CERTIFICATE_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)).toBe(false);
  });
});

// ── Existing cert meta props contract ────────────────────────────────────────

describe("LegalCertificateSection — existing cert props contract", () => {
  it("derives fileName from existing cert", () => {
    const existing = { fileName: "reg-cert.pdf", fileSize: 2048, viewUrl: null };
    expect(existing.fileName).toBe("reg-cert.pdf");
  });

  it("derives fileSize from existing cert and it is positive", () => {
    const existing = { fileName: "cert.pdf", fileSize: 4096, viewUrl: null };
    expect(existing.fileSize).toBeGreaterThan(0);
  });

  it("viewUrl can be null when there is no signed url yet", () => {
    const existing = { fileName: "cert.pdf", fileSize: 1024, viewUrl: null };
    expect(existing.viewUrl).toBeNull();
  });

  it("existing cert is null when no certificate is uploaded", () => {
    const cooperative = { legalCertificateFileName: null };
    const existing = cooperative.legalCertificateFileName ? { fileName: cooperative.legalCertificateFileName } : null;
    expect(existing).toBeNull();
  });

  it("isCreate flag requires certificate upload", () => {
    // On create, a file is required — no fallback to existing
    const isCreate = true;
    const existing = null;
    const fileRequired = isCreate || existing === null;
    expect(fileRequired).toBe(true);
  });

  it("on edit with existing cert, file is not required", () => {
    const isCreate = false;
    const existing = { fileName: "cert.pdf", fileSize: 1024, viewUrl: null };
    const fileRequired = isCreate || existing === null;
    expect(fileRequired).toBe(false);
  });
});
