"use client";

import { useRef, useState, useCallback, type DragEvent, type KeyboardEvent } from "react";
import {
  UploadCloud,
  XCircle,
  CheckCircle2,
  Download,
  Loader2,
  FileText,
  X,
  ArrowLeft,
} from "lucide-react";
import { Button, ButtonLink, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { validateImportCsv, bulkImportEmployees } from "./actions";
import type { ParsedEmployeeRow } from "./bulk-import";
import type { ImportRowResult } from "./bulk-import";

// ── Types ─────────────────────────────────────────────────────────────────────

type PreviewData = {
  summary: { total: number; valid: number; invalid: number };
  validRows: ParsedEmployeeRow[];
  invalidRows: { rowIndex: number; name: string; errors: string[] }[];
};

type ImportResultData = {
  results: ImportRowResult[];
  createdCount: number;
  errorCount: number;
};

type Step = "upload" | "preview" | "results";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isCsvFile(file: File): boolean {
  return (
    file.type === "text/csv" ||
    file.type === "application/vnd.ms-excel" ||
    file.name.toLowerCase().endsWith(".csv")
  );
}

// ── Step 1: Upload ────────────────────────────────────────────────────────────

function UploadStep({
  selectedFile,
  onFileSelect,
  onFileRemove,
  onValidate,
  isValidating,
}: {
  selectedFile: File | null;
  onFileSelect: (file: File) => void;
  onFileRemove: () => void;
  onValidate: () => void;
  isValidating: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file && isCsvFile(file)) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && isCsvFile(file)) {
        onFileSelect(file);
      }
      // Reset input so selecting the same file again fires change
      e.target.value = "";
    },
    [onFileSelect]
  );

  const handleZoneClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleZoneKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fileInputRef.current?.click();
      }
    },
    []
  );

  const canValidate = selectedFile !== null && !isValidating;

  return (
    <div className="space-y-4">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        tabIndex={-1}
        onChange={handleFileChange}
        aria-hidden="true"
      />

      {/* Drop zone */}
      {!selectedFile ? (
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload CSV file: drag and drop or click to browse"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleZoneClick}
          onKeyDown={handleZoneKeyDown}
          className={[
            "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-8 py-12 text-center transition-colors cursor-pointer select-none",
            isDragOver
              ? "border-brand-500 bg-brand-50"
              : "border-ink-900/15 bg-sand-100/40 hover:border-brand-400 hover:bg-brand-50/30",
          ].join(" ")}
        >
          <UploadCloud
            className={[
              "h-10 w-10 transition-colors",
              isDragOver ? "text-brand-600" : "text-ink-900/30",
            ].join(" ")}
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-medium text-ink-900">
              Drag a CSV file here or{" "}
              <span className="text-brand-700 underline underline-offset-2">browse files</span>
            </p>
            <p className="mt-1 text-xs text-ink-900/45">Accepts .csv files only</p>
          </div>
        </div>
      ) : (
        /* Selected file info */
        <div className="flex items-center gap-3 rounded-xl border border-ink-900/10 bg-sand-100/40 px-4 py-3.5">
          <FileText className="h-8 w-8 shrink-0 text-brand-600" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink-900">{selectedFile.name}</p>
            <p className="text-xs text-ink-900/50">{formatFileSize(selectedFile.size)}</p>
          </div>
          <button
            type="button"
            onClick={onFileRemove}
            aria-label="Remove selected file"
            className="shrink-0 rounded-md p-1 text-ink-900/40 transition-colors hover:bg-ink-900/8 hover:text-ink-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Field reference */}
      <details className="rounded-lg border border-ink-900/10 bg-sand-100/40 text-xs">
        <summary className="cursor-pointer select-none px-4 py-2.5 font-medium text-ink-900/60 hover:text-ink-900">
          CSV field reference
        </summary>
        <div className="border-t border-ink-900/8 px-4 pb-4 pt-3 text-ink-900/65">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-1.5 sm:grid-cols-2">
            <div><dt className="inline font-medium">middleName</dt><dd className="inline"> — Father&apos;s name (required, Ethiopian convention)</dd></div>
            <div><dt className="inline font-medium">gender</dt><dd className="inline"> — MALE or FEMALE</dd></div>
            <div><dt className="inline font-medium">maritalStatus</dt><dd className="inline"> — SINGLE · MARRIED · DIVORCED · WIDOWED · OTHER</dd></div>
            <div><dt className="inline font-medium">employmentType</dt><dd className="inline"> — PERMANENT · CONTRACT · TEMPORARY · PROBATION · INTERNSHIP</dd></div>
            <div><dt className="inline font-medium">educationLevel</dt><dd className="inline"> — HIGH_SCHOOL · CERTIFICATE · DIPLOMA · BACHELOR · MASTER · PHD · OTHER</dd></div>
            <div><dt className="inline font-medium">fieldOfStudy</dt><dd className="inline"> — For HIGH_SCHOOL: must be &quot;Natural Science&quot; or &quot;Social Science&quot;</dd></div>
            <div><dt className="inline font-medium">institutionType</dt><dd className="inline"> — HIGH_SCHOOL · UNIVERSITY · COLLEGE · TVET · OTHER</dd></div>
            <div><dt className="inline font-medium">qualificationStatus</dt><dd className="inline"> — COMPLETED or IN_PROGRESS</dd></div>
            <div><dt className="inline font-medium">dateOfBirth</dt><dd className="inline"> — ISO date (YYYY-MM-DD), employee must be ≥21 years old</dd></div>
            <div><dt className="inline font-medium">manager</dt><dd className="inline"> — Employee ID (e.g. EMP-0001) or full name, or leave blank</dd></div>
            <div><dt className="inline font-medium">department / position</dt><dd className="inline"> — Must match active records (case-insensitive)</dd></div>
          </dl>
          <p className="mt-3 text-ink-900/45">All imported employees start with status <strong>ONBOARDING</strong>.</p>
        </div>
      </details>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button
          type="button"
          onClick={onValidate}
          disabled={!canValidate}
          aria-busy={isValidating}
        >
          {isValidating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Validating…
            </>
          ) : (
            "Validate CSV"
          )}
        </Button>

        <ButtonLink href="/employees" variant="outline">
          Cancel
        </ButtonLink>

        <a
          href="/templates/employee-import-template.csv"
          download
          className={buttonClasses("ghost", "md", "ml-auto text-brand-700")}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Download Template
        </a>
      </div>
    </div>
  );
}

// ── Step 2: Preview & Confirm ──────────────────────────────────────────────────

const PREVIEW_LIMIT = 10;

function PreviewStep({
  previewData,
  onConfirm,
  onBack,
  isImporting,
}: {
  previewData: PreviewData;
  onConfirm: () => void;
  onBack: () => void;
  isImporting: boolean;
}) {
  const { summary, validRows, invalidRows } = previewData;
  const hasErrors = invalidRows.length > 0;
  const hasValid = validRows.length > 0;
  const displayRows = validRows.slice(0, PREVIEW_LIMIT);
  const moreCount = validRows.length - PREVIEW_LIMIT;

  return (
    <div className="space-y-5">
      {/* Summary badges */}
      <div className="flex flex-wrap items-center gap-2" aria-live="polite">
        <Badge tone="neutral">{summary.total} {summary.total === 1 ? "row" : "rows"} total</Badge>
        <Badge tone="success">{summary.valid} valid</Badge>
        {summary.invalid > 0 && (
          <Badge tone="danger">{summary.invalid} with errors</Badge>
        )}
      </div>

      {/* Validation errors panel */}
      {hasErrors && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50"
        >
          <div className="border-b border-red-200 px-4 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
              Validation Errors
            </p>
          </div>
          <ul className="max-h-64 divide-y divide-red-100 overflow-y-auto">
            {invalidRows.map((row) => (
              <li key={row.rowIndex} className="flex items-start gap-2.5 px-4 py-3">
                <XCircle
                  className="mt-0.5 h-4 w-4 shrink-0 text-red-500"
                  aria-hidden="true"
                />
                <div className="min-w-0 text-sm">
                  <span className="font-medium text-red-800">
                    Row {row.rowIndex}
                    {row.name ? ` (${row.name})` : ""}:
                  </span>{" "}
                  <span className="text-red-700">{row.errors.join("; ")}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Preview table */}
      {hasValid && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-900/50">
            Preview — valid rows
          </p>
          <div className="overflow-x-auto rounded-xl border border-ink-900/8">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink-900/8 bg-sand-100/50 text-xs font-medium uppercase tracking-wide text-ink-900/50">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">First Name</th>
                  <th className="px-4 py-3 font-medium">Father's Name</th>
                  <th className="px-4 py-3 font-medium">Last Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Position</th>
                  <th className="px-4 py-3 font-medium">Hire Date</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-900/6">
                {displayRows.map((row) => (
                  <tr key={row.rowIndex} className="hover:bg-sand-100/70">
                    <td className="px-4 py-3 text-ink-900/50">{row.rowIndex}</td>
                    <td className="px-4 py-3 text-ink-900">{row.firstName}</td>
                    <td className="px-4 py-3 text-ink-900">{row.middleName}</td>
                    <td className="px-4 py-3 text-ink-900">{row.lastName}</td>
                    <td className="px-4 py-3 text-ink-900/70">{row.email}</td>
                    <td className="px-4 py-3 text-ink-900/80">{row.department}</td>
                    <td className="px-4 py-3 text-ink-900/80">{row.position}</td>
                    <td className="px-4 py-3 text-ink-900/70">{row.hireDate}</td>
                    <td className="px-4 py-3 text-ink-900/70">{row.employmentType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {moreCount > 0 && (
              <div className="border-t border-ink-900/8 px-4 py-2.5 text-center">
                <p className="text-xs text-ink-900/45">
                  …and {moreCount} more {moreCount === 1 ? "row" : "rows"} not shown
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        {hasValid && (
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isImporting}
            aria-busy={isImporting}
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Importing…
              </>
            ) : (
              `Confirm Import (${validRows.length} ${validRows.length === 1 ? "employee" : "employees"})`
            )}
          </Button>
        )}

        <Button type="button" variant="outline" onClick={onBack} disabled={isImporting}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Select Different File
        </Button>
      </div>
    </div>
  );
}

// ── Step 3: Results ────────────────────────────────────────────────────────────

function ResultsStep({
  importResult,
  onImportAnother,
}: {
  importResult: ImportResultData;
  onImportAnother: () => void;
}) {
  const { results, createdCount, errorCount } = importResult;
  const failedRows = results.filter(
    (r): r is Extract<ImportRowResult, { status: "error" }> => r.status === "error"
  );

  function downloadErrorReport() {
    const header = "row,employeeName,errors";
    const lines = failedRows.map((r) => {
      const name = `"${r.name.replace(/"/g, '""')}"`;
      const errors = `"${r.errors.join("; ").replace(/"/g, '""')}"`;
      return `${r.row},${name},${errors}`;
    });
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `import-errors-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div aria-live="polite" className="space-y-1">
        {createdCount > 0 && (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            <p className="text-sm font-medium text-emerald-700">
              {createdCount} {createdCount === 1 ? "employee" : "employees"} successfully imported
            </p>
          </div>
        )}
        {errorCount > 0 && (
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" aria-hidden="true" />
            <p className="text-sm font-medium text-red-700">
              {errorCount} {errorCount === 1 ? "row" : "rows"} skipped
            </p>
          </div>
        )}
        {createdCount === 0 && errorCount === 0 && (
          <p className="text-sm text-ink-900/60">No records were processed.</p>
        )}
      </div>

      {/* Failed rows detail */}
      {failedRows.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50">
          <div className="border-b border-red-200 px-4 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
              Rejected Rows
            </p>
          </div>
          <ul className="max-h-64 divide-y divide-red-100 overflow-y-auto">
            {failedRows.map((r) => (
              <li key={r.row} className="flex items-start gap-2.5 px-4 py-3">
                <XCircle
                  className="mt-0.5 h-4 w-4 shrink-0 text-red-500"
                  aria-hidden="true"
                />
                <div className="min-w-0 text-sm">
                  <span className="font-medium text-red-800">
                    Row {r.row} ({r.name}):
                  </span>{" "}
                  <span className="text-red-700">{r.errors.join("; ")}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onImportAnother}>
          Import Another File
        </Button>

        <ButtonLink href="/employees" variant="primary">
          View Employees
        </ButtonLink>

        {failedRows.length > 0 && (
          <button
            type="button"
            onClick={downloadErrorReport}
            className={buttonClasses("ghost", "md", "ml-auto text-brand-700")}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download Error Report
          </button>
        )}
      </div>
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export function BulkImportForm() {
  const [step, setStep] = useState<Step>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [importResult, setImportResult] = useState<ImportResultData | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Step 1 handlers ──────────────────────────────────────────────────────

  function handleFileSelect(file: File) {
    setSelectedFile(file);
    setErrorMessage(null);
  }

  function handleFileRemove() {
    setSelectedFile(null);
    setErrorMessage(null);
  }

  async function handleValidate() {
    if (!selectedFile) return;
    setIsValidating(true);
    setErrorMessage(null);

    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      const result = await validateImportCsv(null, fd);

      if (!result.success) {
        setErrorMessage(result.error.message);
      } else {
        setPreviewData(result.data);
        setStep("preview");
      }
    } catch {
      setErrorMessage("An unexpected error occurred while validating the file.");
    } finally {
      setIsValidating(false);
    }
  }

  // ── Step 2 handlers ──────────────────────────────────────────────────────

  function handleBack() {
    setSelectedFile(null);
    setPreviewData(null);
    setErrorMessage(null);
    setStep("upload");
  }

  async function handleConfirmImport() {
    if (!selectedFile) return;
    setIsImporting(true);
    setErrorMessage(null);

    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      const result = await bulkImportEmployees(null, fd);

      if (!result.success) {
        setErrorMessage(result.error.message);
      } else {
        setImportResult(result.data);
        setStep("results");
      }
    } catch {
      setErrorMessage("An unexpected error occurred while importing employees.");
    } finally {
      setIsImporting(false);
    }
  }

  // ── Step 3 handler ───────────────────────────────────────────────────────

  function handleImportAnother() {
    setSelectedFile(null);
    setPreviewData(null);
    setImportResult(null);
    setErrorMessage(null);
    setStep("upload");
  }

  // ── Step labels for progress indicator ───────────────────────────────────

  const STEPS: { key: Step; label: string }[] = [
    { key: "upload", label: "Upload" },
    { key: "preview", label: "Preview" },
    { key: "results", label: "Results" },
  ];

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <Card className="max-w-4xl">
      {/* Step indicator */}
      <div className="flex items-center gap-0 border-b border-ink-900/8 px-6 py-4">
        {STEPS.map((s, i) => {
          const isActive = s.key === step;
          const isDone = i < stepIndex;
          return (
            <div key={s.key} className="flex items-center">
              <div className="flex items-center gap-2">
                <span
                  className={[
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                    isActive
                      ? "bg-brand-700 text-white"
                      : isDone
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-ink-900/8 text-ink-900/40",
                  ].join(" ")}
                >
                  {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span
                  className={[
                    "text-sm font-medium",
                    isActive ? "text-ink-900" : isDone ? "text-emerald-700" : "text-ink-900/40",
                  ].join(" ")}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <span className="mx-3 h-px w-8 bg-ink-900/15" aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>

      {/* Body */}
      <div className="p-6">
        {/* Global error banner */}
        {errorMessage && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {errorMessage}
          </div>
        )}

        {step === "upload" && (
          <UploadStep
            selectedFile={selectedFile}
            onFileSelect={handleFileSelect}
            onFileRemove={handleFileRemove}
            onValidate={handleValidate}
            isValidating={isValidating}
          />
        )}

        {step === "preview" && previewData && (
          <PreviewStep
            previewData={previewData}
            onConfirm={handleConfirmImport}
            onBack={handleBack}
            isImporting={isImporting}
          />
        )}

        {step === "results" && importResult && (
          <ResultsStep
            importResult={importResult}
            onImportAnother={handleImportAnother}
          />
        )}
      </div>
    </Card>
  );
}
