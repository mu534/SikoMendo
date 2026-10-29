"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { uploadEmployeeDocument } from "./actions";
import { Input, Select, FieldGroup, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { validateEmployeeDocumentFile, EMPLOYEE_DOCUMENT_MAX_BYTES, formatBytes } from "@/lib/file-limits";

const DOCUMENT_TYPES = ["CONTRACT", "ID_DOCUMENT", "CERTIFICATE", "RESUME", "OTHER"];

export function DocumentUploadForm({ employeeId }: { employeeId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const action = uploadEmployeeDocument.bind(null, employeeId);
  const [state, formAction, isPending] = useActionState(action, null);
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      setFileError(null);
    }
  }, [state]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) { setFileError(null); return; }
    const err = validateEmployeeDocumentFile(file);
    setFileError(err);
    if (err) e.target.value = "";
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3 border-t border-ink-900/8 px-6 py-4">
      <FieldGroup className="min-w-[180px] flex-1">
        <Label htmlFor="doc-title">Title</Label>
        <Input id="doc-title" name="title" placeholder="e.g. Employment contract" required />
      </FieldGroup>
      <FieldGroup>
        <Label htmlFor="doc-type">Type</Label>
        <Select id="doc-type" name="type" defaultValue="OTHER">
          {DOCUMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace("_", " ")}
            </option>
          ))}
        </Select>
      </FieldGroup>
      <FieldGroup>
        <Label htmlFor="doc-file">File</Label>
        <input
          id="doc-file"
          name="file"
          type="file"
          required
          className="block text-sm"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
          onChange={handleFileChange}
        />
        <p className="mt-1 text-xs text-ink-900/45">
          PDF, JPG, PNG, WebP, DOC, DOCX · max {formatBytes(EMPLOYEE_DOCUMENT_MAX_BYTES)}
        </p>
        {fileError && (
          <p role="alert" className="mt-1 text-xs font-medium text-red-600">{fileError}</p>
        )}
      </FieldGroup>
      <Button type="submit" variant="secondary" disabled={isPending || !!fileError}>
        <Upload className="h-4 w-4" />
        {isPending ? "Uploading…" : "Upload"}
      </Button>
      {state && !state.success && <p className="w-full text-sm text-red-600">{state.error.message}</p>}
    </form>
  );
}
