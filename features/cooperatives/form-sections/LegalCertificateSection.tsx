"use client";

import { useState, useRef } from "react";
import { ShieldCheck, Upload, FileCheck2, AlertTriangle, Eye, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionHeader, RequiredMark } from "../form-utils";
import {
  CERTIFICATE_ALLOWED_EXTENSIONS,
  CERTIFICATE_MAX_BYTES,
} from "../schemas";
import { formatBytes } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type ExistingCert = {
  fileName: string;
  fileSize: number; // bytes
  /** If provided, shows a "View" link. Generated server-side as a signed URL. */
  viewUrl?: string | null;
};

type Props = {
  /** Pass the existing cert meta when editing; omit on create. */
  existing?: ExistingCert | null;
  /** Whether this is a create form (makes file required immediately) vs edit. */
  isCreate?: boolean;
  /** Called when the user selects/clears a file, so the parent summary can update. */
  onCertChange?: (uploaded: boolean) => void;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCEPT = ".pdf,.jpg,.jpeg,.png";
const MAX_MB = CERTIFICATE_MAX_BYTES / 1024 / 1024;

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Section 3b of CooperativeForm: Legal Certificate.
 * Placed inside the Registration & Legal card.
 *
 * On CREATE: certificate upload is mandatory.
 * On EDIT:   an existing certificate is shown with View / Replace options.
 *            Uploading a replacement is optional — the form submit only updates
 *            the other fields; to replace the cert the user clicks "Replace" and
 *            selects a new file (the replace is submitted via the standalone
 *            uploadCooperativeCertificate action on the detail page, not here).
 *
 * The file input name is always "legalCertificate" so the server action reads it
 * via formData.get("legalCertificate").
 */
export function LegalCertificateSection({ existing, isCreate = false, onCertChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);

  const hasExisting = !!existing?.fileName;
  // Show the upload dropzone when: (a) creating, (b) no existing cert, (c) user
  // clicked "Replace".
  const showUpload = isCreate || !hasExisting || replacing;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setClientError(null);
    setSelectedFile(null);

    if (!file) return;

    // Client-side pre-validation (mirrors server-side validateCertificateFile)
    if (file.size > CERTIFICATE_MAX_BYTES) {
      setClientError(
        `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed: ${MAX_MB} MB.`
      );
      e.target.value = "";
      onCertChange?.(false);
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!(CERTIFICATE_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
      setClientError(
        `Unsupported format ".${ext}". Allowed: ${CERTIFICATE_ALLOWED_EXTENSIONS.join(", ")}.`
      );
      e.target.value = "";
      onCertChange?.(false);
      return;
    }
    setSelectedFile(file);
    onCertChange?.(true);
  }

  function handleReplace() {
    setReplacing(true);
    setSelectedFile(null);
    setClientError(null);
    // Focus the file input after the state update re-renders
    setTimeout(() => inputRef.current?.click(), 50);
  }

  function handleCancelReplace() {
    setReplacing(false);
    setSelectedFile(null);
    setClientError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="mt-6 border-t border-ink-900/8 pt-6">
      {/* Sub-section heading */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-50 text-brand-700">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        </div>
        <h4 className="font-display text-sm font-semibold text-ink-900">
          Legal Certificate
          {(isCreate || !hasExisting) && <RequiredMark />}
        </h4>
      </div>

      <p className="mb-4 text-xs text-ink-900/55">
        Upload the official cooperative registration / legal certificate issued by the relevant authority.
        Accepted formats: PDF, JPG, JPEG, PNG · Max {MAX_MB} MB.
      </p>

      {/* ── Existing certificate display ──────────────────────────────────── */}
      {hasExisting && !replacing && existing && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3"
          role="status"
          aria-label="Legal certificate uploaded"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <FileCheck2 className="h-4.5 w-4.5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-emerald-900">
                ✓ Legal certificate uploaded
              </p>
              <p className="mt-0.5 text-xs text-emerald-700">
                {existing.fileName}
                {existing.fileSize > 0 && (
                  <span className="ml-1 text-emerald-600/70">· {formatBytes(existing.fileSize)}</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {existing.viewUrl && (
              <a
                href={existing.viewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 text-xs font-medium text-emerald-800 hover:bg-emerald-50 transition-colors"
                aria-label="View legal certificate"
              >
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                View
              </a>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReplace}
              aria-label="Replace legal certificate"
              className="h-8 gap-1.5 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Replace
            </Button>
          </div>
        </div>
      )}

      {/* ── Missing certificate warning (existing record, no cert yet) ────── */}
      {hasExisting === false && !isCreate && !replacing && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
          role="alert"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <p className="text-sm font-medium text-amber-900">Legal certificate required</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReplace}
            className="h-8 gap-1.5 border-amber-300 text-xs text-amber-900 hover:bg-amber-100"
            aria-label="Upload legal certificate"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            Upload certificate
          </Button>
        </div>
      )}

      {/* ── Upload zone ───────────────────────────────────────────────────── */}
      {showUpload && (
        <div className="space-y-3">
          {/* File input */}
          <label
            htmlFor="legalCertificate"
            className={[
              "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
              clientError
                ? "border-red-300 bg-red-50"
                : selectedFile
                ? "border-emerald-300 bg-emerald-50"
                : "border-ink-900/15 bg-sand-50 hover:border-brand-400 hover:bg-brand-50/40",
            ].join(" ")}
          >
            <div
              className={[
                "mb-3 flex h-10 w-10 items-center justify-center rounded-full",
                clientError
                  ? "bg-red-100 text-red-600"
                  : selectedFile
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-brand-100 text-brand-700",
              ].join(" ")}
            >
              {clientError ? (
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              ) : selectedFile ? (
                <FileCheck2 className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Upload className="h-5 w-5" aria-hidden="true" />
              )}
            </div>

            {selectedFile ? (
              <>
                <p className="text-sm font-medium text-emerald-900">
                  {selectedFile.name}
                </p>
                <p className="mt-0.5 text-xs text-emerald-700">
                  {formatBytes(selectedFile.size)} · Ready to upload
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-ink-900">
                  Click to select a file
                </p>
                <p className="mt-1 text-xs text-ink-900/50">
                  PDF, JPG, JPEG, PNG · Max {MAX_MB} MB
                </p>
              </>
            )}

            <input
              ref={inputRef}
              id="legalCertificate"
              name="legalCertificate"
              type="file"
              accept={ACCEPT}
              required={isCreate || (!hasExisting && !replacing)}
              aria-required={isCreate || (!hasExisting && !replacing) ? "true" : undefined}
              className="sr-only"
              onChange={handleFileChange}
            />
          </label>

          {/* Client-side error */}
          {clientError && (
            <p className="flex items-center gap-1.5 text-sm text-red-600" role="alert">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {clientError}
            </p>
          )}

          {/* Cancel replace button (edit mode only) */}
          {replacing && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancelReplace}
              className="text-xs text-ink-900/60"
            >
              Cancel replace
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
