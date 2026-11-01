"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { ShieldCheck, Upload, FileCheck2, AlertTriangle, Eye, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeader, RequiredMark } from "../form-utils";
import {
  CERTIFICATE_ALLOWED_EXTENSIONS,
  CERTIFICATE_MAX_BYTES,
} from "../schemas";
import { formatBytes } from "@/lib/utils";

type ExistingCert = {
  fileName: string;
  fileSize: number;
  viewUrl?: string | null;
};

type Props = {
  existing?: ExistingCert | null;
  isCreate?: boolean;
  onCertChange?: (uploaded: boolean) => void;
};

const ACCEPT = ".pdf,.jpg,.jpeg,.png";
const MAX_MB = CERTIFICATE_MAX_BYTES / 1024 / 1024;

export function LegalCertificateSection({ existing, isCreate = false, onCertChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);
  const t = useTranslations("cooperatives.form");
  const tC = useTranslations("common");

  const hasExisting = !!existing?.fileName;
  const showUpload = isCreate || !hasExisting || replacing;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setClientError(null);
    setSelectedFile(null);
    if (!file) return;
    if (file.size > CERTIFICATE_MAX_BYTES) {
      setClientError(`${formatBytes(file.size)} > ${MAX_MB} MB`);
      e.target.value = "";
      onCertChange?.(false);
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!(CERTIFICATE_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
      setClientError(`.${ext}`);
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
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        </div>
        <h4 className="font-display text-sm font-semibold text-ink-900">
          {t("legalCertificate")}
          {(isCreate || !hasExisting) && <RequiredMark />}
        </h4>
      </div>

      <p className="mb-4 text-xs text-ink-900/55">{t("certificateHint")}</p>

      {hasExisting && !replacing && existing && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3" role="status">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <FileCheck2 className="h-4.5 w-4.5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-emerald-900">{t("legalCertificate")}</p>
              <p className="mt-0.5 text-xs text-emerald-700">
                {existing.fileName}
                {existing.fileSize > 0 && <span className="ml-1 text-emerald-600/70">· {formatBytes(existing.fileSize)}</span>}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {existing.viewUrl && (
              <a href={existing.viewUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 text-xs font-medium text-emerald-800 hover:bg-emerald-50 transition-colors">
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                {tC("view")}
              </a>
            )}
            <Button type="button" variant="outline" size="sm" onClick={handleReplace} className="h-8 gap-1.5 text-xs">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              {tC("update")}
            </Button>
          </div>
        </div>
      )}

      {hasExisting === false && !isCreate && !replacing && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3" role="alert">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <p className="text-sm font-medium text-amber-900">{t("legalCertificate")}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleReplace}
            className="h-8 gap-1.5 border-amber-300 text-xs text-amber-900 hover:bg-amber-100">
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            {t("uploadCertificate")}
          </Button>
        </div>
      )}

      {showUpload && (
        <div className="space-y-3">
          <label htmlFor="legalCertificate"
            className={["flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
              clientError ? "border-red-300 bg-red-50" : selectedFile ? "border-emerald-300 bg-emerald-50" : "border-ink-900/15 bg-sand-50 hover:border-brand-400 hover:bg-brand-50/40",
            ].join(" ")}>
            <div className={["mb-3 flex h-10 w-10 items-center justify-center rounded-full",
              clientError ? "bg-red-100 text-red-600" : selectedFile ? "bg-emerald-100 text-emerald-700" : "bg-brand-100 text-brand-700",
            ].join(" ")}>
              {clientError ? <AlertTriangle className="h-5 w-5" aria-hidden="true" /> : selectedFile ? <FileCheck2 className="h-5 w-5" aria-hidden="true" /> : <Upload className="h-5 w-5" aria-hidden="true" />}
            </div>

            {selectedFile ? (
              <>
                <p className="text-sm font-medium text-emerald-900">{selectedFile.name}</p>
                <p className="mt-0.5 text-xs text-emerald-700">{formatBytes(selectedFile.size)}</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-ink-900">{t("uploadCertificate")}</p>
                <p className="mt-1 text-xs text-ink-900/50">PDF, JPG, PNG · Max {MAX_MB} MB</p>
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

          {clientError && (
            <p className="flex items-center gap-1.5 text-sm text-red-600" role="alert">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {clientError}
            </p>
          )}

          {replacing && (
            <Button type="button" variant="ghost" size="sm" onClick={handleCancelReplace} className="text-xs text-ink-900/60">
              {tC("cancel")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
