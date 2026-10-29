/**
 * Centralised file-upload limits and validation helpers for the HRMIS.
 *
 * Every upload in the application must derive its limits from this file so
 * they stay in sync across client pre-validation, server action enforcement,
 * and UI hint text. Change a limit here and it propagates everywhere.
 */

// ── Size limits ────────────────────────────────────────────────────────────────

/** Employee / user profile photo — 5 MB. JPG, PNG, WebP. */
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

/** Employee document attachments (contracts, IDs, certificates, etc.) — 10 MB. */
export const EMPLOYEE_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Leave supporting document (medical notes, certificates, etc.) — 5 MB.
 * Smaller than employee documents because these are typically scanned A4 pages
 * or simple PDF attachments.
 */
export const LEAVE_DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Organisation logo — 2 MB.
 * Logos only need to be web-quality; SVG/PNG renders sharply at small sizes
 * and a 2 MB budget is generous for any raster or vector logo.
 */
export const ORG_LOGO_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Employee CSV import file — 5 MB.
 * A CSV of 5 MB at ~200 bytes per row is ~25 000 rows — far beyond any
 * realistic single import batch. This protects against accidental uploads of
 * the wrong file type.
 */
export const CSV_IMPORT_MAX_BYTES = 5 * 1024 * 1024;

// ── Allowed MIME types ─────────────────────────────────────────────────────────

export const PHOTO_ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export const PHOTO_ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export const EMPLOYEE_DOCUMENT_ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/msword",                                                     // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
]);

export const EMPLOYEE_DOCUMENT_ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".jpg", ".jpeg", ".png", ".webp", ".doc", ".docx",
]);

/** Leave supporting documents accept the same types as employee documents. */
export const LEAVE_DOCUMENT_ALLOWED_MIME_TYPES = EMPLOYEE_DOCUMENT_ALLOWED_MIME_TYPES;
export const LEAVE_DOCUMENT_ALLOWED_EXTENSIONS = EMPLOYEE_DOCUMENT_ALLOWED_EXTENSIONS;

export const ORG_LOGO_ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
]);

export const ORG_LOGO_ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);

// ── Shared formatter ──────────────────────────────────────────────────────────

/** Formats a byte count as a human-readable size string (e.g. "5 MB", "512 KB"). */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

// ── Validation helpers (usable on both client and server) ──────────────────────

export type FileValidationError = string; // human-readable message, or null on success

/**
 * Validates a file against a set of constraints.
 * Returns an error message string, or null when the file is valid.
 */
export function validateFile(
  file: File,
  opts: {
    maxBytes: number;
    allowedMimeTypes: ReadonlySet<string>;
    allowedExtensions: ReadonlySet<string>;
    label?: string; // e.g. "Photo", "Document", "Logo" — used in messages
  }
): FileValidationError | null {
  const label = opts.label ?? "File";

  if (file.size === 0) return `${label} is empty.`;

  if (file.size > opts.maxBytes) {
    return `${label} is too large (${formatBytes(file.size)}). Maximum allowed size is ${formatBytes(opts.maxBytes)}.`;
  }

  const mime = file.type.toLowerCase().split(";")[0]?.trim() ?? "";
  if (mime && !opts.allowedMimeTypes.has(mime)) {
    return `${label} type "${file.type || "unknown"}" is not allowed.`;
  }

  const ext = file.name.includes(".")
    ? `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`
    : "";
  if (ext && !opts.allowedExtensions.has(ext)) {
    return `${label} extension "${ext}" is not allowed.`;
  }

  return null;
}

/** Pre-built validators for each upload type — call and check for null. */

export function validatePhotoFile(file: File): FileValidationError | null {
  return validateFile(file, {
    maxBytes: PHOTO_MAX_BYTES,
    allowedMimeTypes: PHOTO_ALLOWED_MIME_TYPES,
    allowedExtensions: PHOTO_ALLOWED_EXTENSIONS,
    label: "Photo",
  });
}

export function validateEmployeeDocumentFile(file: File): FileValidationError | null {
  return validateFile(file, {
    maxBytes: EMPLOYEE_DOCUMENT_MAX_BYTES,
    allowedMimeTypes: EMPLOYEE_DOCUMENT_ALLOWED_MIME_TYPES,
    allowedExtensions: EMPLOYEE_DOCUMENT_ALLOWED_EXTENSIONS,
    label: "Document",
  });
}

export function validateLeaveDocumentFile(file: File): FileValidationError | null {
  return validateFile(file, {
    maxBytes: LEAVE_DOCUMENT_MAX_BYTES,
    allowedMimeTypes: LEAVE_DOCUMENT_ALLOWED_MIME_TYPES,
    allowedExtensions: LEAVE_DOCUMENT_ALLOWED_EXTENSIONS,
    label: "Supporting document",
  });
}

export function validateOrgLogoFile(file: File): FileValidationError | null {
  return validateFile(file, {
    maxBytes: ORG_LOGO_MAX_BYTES,
    allowedMimeTypes: ORG_LOGO_ALLOWED_MIME_TYPES,
    allowedExtensions: ORG_LOGO_ALLOWED_EXTENSIONS,
    label: "Logo",
  });
}

export function validateCsvImportFile(file: File): FileValidationError | null {
  if (file.size === 0) return "CSV file is empty.";
  if (file.size > CSV_IMPORT_MAX_BYTES) {
    return `CSV file is too large (${formatBytes(file.size)}). Maximum allowed size is ${formatBytes(CSV_IMPORT_MAX_BYTES)}.`;
  }
  const name = file.name.toLowerCase();
  if (!name.endsWith(".csv")) {
    return `Only .csv files are accepted. Selected file: "${file.name}".`;
  }
  return null;
}
