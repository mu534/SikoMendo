"use client";

import { useActionState, useRef, useState, useEffect } from "react";
import { Upload, RefreshCw, AlertTriangle, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CERTIFICATE_ALLOWED_EXTENSIONS,
  CERTIFICATE_MAX_BYTES,
} from "./schemas";
import { formatBytes } from "@/lib/utils";

type Props = {
  cooperativeId: string;
  action: (
    prevState: unknown,
    formData: FormData
  ) => Promise<{ success: boolean; data?: unknown; error?: { message: string } }>;
  mode: "upload" | "replace";
};

const ACCEPT = ".pdf,.jpg,.jpeg,.png";
const MAX_MB = CERTIFICATE_MAX_BYTES / 1024 / 1024;

/**
 * Standalone panel for uploading or replacing the cooperative legal certificate
 * from the detail page (Registration & Legal tab). Does NOT navigate away on
 * success — it shows a success message and the caller page will be revalidated.
 */
export function CertificateUploadPanel({ action, mode }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, formAction, isPending] = useActionState(action, null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(mode === "upload");

  // Reset the form on success so it's ready for another replace if needed
  useEffect(() => {
    if (state && (state as { success: boolean }).success === true) {
      formRef.current?.reset();
      setSelectedFile(null);
      setClientError(null);
      setExpanded(false);
    }
  }, [state]);

  const stateTyped = state as
    | { success: true }
    | { success: false; error: { message: string } }
    | null;

  const serverError =
    stateTyped && stateTyped.success === false ? stateTyped.error.message : null;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setClientError(null);
    setSelectedFile(null);
    if (!file) return;

    if (file.size > CERTIFICATE_MAX_BYTES) {
      setClientError(
        `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max ${MAX_MB} MB.`
      );
      e.target.value = "";
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!(CERTIFICATE_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
      setClientError(
        `Unsupported format ".${ext}". Allowed: ${CERTIFICATE_ALLOWED_EXTENSIONS.join(", ")}.`
      );
      e.target.value = "";
      return;
    }
    setSelectedFile(file);
  }

  if (!expanded) {
    return (
      <div>
        {stateTyped?.success && (
          <p
            role="status"
            className="mb-3 flex items-center gap-1.5 text-sm font-medium text-emerald-700"
          >
            <FileCheck2 className="h-4 w-4" aria-hidden="true" />
            Certificate uploaded successfully. Reload to see the updated file.
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setExpanded(true)}
          className="gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          {mode === "replace" ? "Replace certificate" : "Upload certificate"}
        </Button>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      {/* Success */}
      {stateTyped?.success && (
        <p
          role="status"
          className="flex items-center gap-1.5 text-sm font-medium text-emerald-700"
        >
          <FileCheck2 className="h-4 w-4" aria-hidden="true" />
          Certificate uploaded successfully.
        </p>
      )}

      {/* Server error */}
      {serverError && (
        <p role="alert" className="flex items-center gap-1.5 text-sm text-red-600">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {serverError}
        </p>
      )}

      {/* Drop target */}
      <label
        htmlFor="cert-upload-input"
        className={[
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-6 text-center transition-colors",
          clientError
            ? "border-red-300 bg-red-50"
            : selectedFile
            ? "border-emerald-300 bg-emerald-50"
            : "border-ink-900/15 bg-sand-50 hover:border-brand-400 hover:bg-brand-50/40",
        ].join(" ")}
      >
        <div
          className={[
            "mb-2 flex h-9 w-9 items-center justify-center rounded-full",
            clientError
              ? "bg-red-100 text-red-600"
              : selectedFile
              ? "bg-emerald-100 text-emerald-700"
              : "bg-brand-100 text-brand-700",
          ].join(" ")}
        >
          {clientError ? (
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          ) : selectedFile ? (
            <FileCheck2 className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Upload className="h-4 w-4" aria-hidden="true" />
          )}
        </div>

        {selectedFile ? (
          <>
            <p className="text-sm font-medium text-emerald-900">{selectedFile.name}</p>
            <p className="mt-0.5 text-xs text-emerald-700">
              {formatBytes(selectedFile.size)} · Ready to upload
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-ink-900">Click to select a file</p>
            <p className="mt-1 text-xs text-ink-900/50">
              PDF, JPG, JPEG, PNG · Max {MAX_MB} MB
            </p>
          </>
        )}

        <input
          ref={inputRef}
          id="cert-upload-input"
          name="legalCertificate"
          type="file"
          accept={ACCEPT}
          required
          aria-required="true"
          className="sr-only"
          onChange={handleFileChange}
        />
      </label>

      {/* Client error */}
      {clientError && (
        <p className="flex items-center gap-1.5 text-sm text-red-600" role="alert">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {clientError}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={isPending || !selectedFile}
          className="gap-1.5"
        >
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          {isPending
            ? "Uploading…"
            : mode === "replace"
            ? "Upload replacement"
            : "Upload certificate"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setExpanded(false);
            setSelectedFile(null);
            setClientError(null);
            if (inputRef.current) inputRef.current.value = "";
          }}
          className="text-xs text-ink-900/50"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
