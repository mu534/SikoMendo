"use client";

import { useActionState } from "react";
import { Download, CheckCircle2, XCircle } from "lucide-react";
import { Label, FieldGroup } from "@/components/ui/field";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { bulkImportEmployees } from "./actions";
import type { ImportRowResult } from "./bulk-import";

type ActionState =
  | { success: true; data: { results: ImportRowResult[]; createdCount: number; errorCount: number } }
  | { success: false; error: { message: string } }
  | null;

export function BulkImportForm() {
  const [state, formAction, isPending] = useActionState(bulkImportEmployees, null);
  const typedState = state as ActionState;

  const errorMessage = typedState && typedState.success === false ? typedState.error.message : null;
  const result = typedState && typedState.success ? typedState.data : null;

  return (
    <div className="space-y-6">
      <Card className="max-w-2xl p-6">
        <form action={formAction} className="space-y-5">
          {errorMessage && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
              {errorMessage}
            </div>
          )}

          <FieldGroup>
            <Label htmlFor="file">CSV file</Label>
            <input id="file" name="file" type="file" accept=".csv,text/csv" required className="block text-sm" />
          </FieldGroup>

          <div className="flex items-center gap-3 border-t border-ink-900/8 pt-5">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Importing…" : "Import employees"}
            </Button>
            <ButtonLink href="/employees" variant="ghost">
              Cancel
            </ButtonLink>
            <a
              href="/templates/employee-import-template.csv"
              download
              className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
            >
              <Download className="h-3.5 w-3.5" />
              Download template
            </a>
          </div>
        </form>
      </Card>

      {result && (
        <Card className="max-w-2xl p-6">
          <p className="mb-4 text-sm font-medium text-ink-900">
            <span className="text-emerald-700">{result.createdCount} created</span>
            {result.errorCount > 0 && <span className="text-red-700"> · {result.errorCount} skipped</span>}
          </p>

          <ul className="max-h-96 space-y-2 overflow-y-auto">
            {result.results.map((r) => (
              <li key={r.row} className="flex items-start gap-2 text-sm">
                {r.status === "created" ? (
                  <>
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>
                      Row {r.row}: <span className="font-medium text-ink-900">{r.name}</span>{" "}
                      <span className="text-ink-900/50">({r.employeeId})</span>
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    <span>
                      Row {r.row}: <span className="font-medium text-ink-900">{r.name}</span>{" "}
                      <span className="text-red-700">— {r.errors.join("; ")}</span>
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
