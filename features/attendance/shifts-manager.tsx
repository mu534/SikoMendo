"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus, Pencil, Power } from "lucide-react";
import { createShift, updateShift, setShiftActive, deleteShift } from "./shift-actions";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldGroup } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import type { ShiftRow } from "./shift-queries";

// ── Shift form (create or edit) ───────────────────────────────────────────

function ShiftForm({
  shift,
  onDone,
}: {
  shift?: ShiftRow;
  onDone: () => void;
}) {
  const boundAction = shift
    ? updateShift.bind(null, shift.id)
    : createShift;

  const [state, formAction, isPending] = useActionState(boundAction, null);

  const error   = state && !state.success ? state.error.message : null;
  const success = state?.success === true;

  if (success) {
    // Auto-close on success
    if (typeof onDone === "function") onDone();
  }

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-xl border border-ink-900/10 bg-sand-50 p-4"
    >
      {error && (
        <p role="alert" className="text-sm text-red-600">{error}</p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FieldGroup>
          <Label htmlFor={`shift-name-${shift?.id ?? "new"}`}>Shift name</Label>
          <Input
            id={`shift-name-${shift?.id ?? "new"}`}
            name="name"
            placeholder="e.g. Morning Shift"
            defaultValue={shift?.name ?? ""}
            required
          />
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor={`shift-start-${shift?.id ?? "new"}`}>Start time</Label>
          <Input
            id={`shift-start-${shift?.id ?? "new"}`}
            name="startTime"
            type="time"
            defaultValue={shift?.startTime ?? "08:00"}
            required
          />
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor={`shift-end-${shift?.id ?? "new"}`}>End time</Label>
          <Input
            id={`shift-end-${shift?.id ?? "new"}`}
            name="endTime"
            type="time"
            defaultValue={shift?.endTime ?? "17:00"}
            required
          />
        </FieldGroup>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving…" : shift ? "Update shift" : "Add shift"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────

export function ShiftsManager({ shifts }: { shifts: ShiftRow[] }) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function fmtTime(hhmm: string): string {
    const [h, m] = hhmm.split(":").map(Number);
    const period = (h ?? 0) >= 12 ? "PM" : "AM";
    const h12    = (h ?? 0) % 12 || 12;
    return `${h12}:${String(m ?? 0).padStart(2, "0")} ${period}`;
  }

  function handleToggleActive(id: string, currentlyActive: boolean) {
    startTransition(async () => {
      await setShiftActive(id, !currentlyActive);
    });
  }

  return (
    <div className="space-y-3">
      {/* Existing shifts */}
      {shifts.length === 0 && !showCreate && (
        <p className="text-sm text-ink-900/45 italic">
          No shifts defined yet. Add one below.
        </p>
      )}

      {shifts.map((shift) =>
        editingId === shift.id ? (
          <ShiftForm
            key={shift.id}
            shift={shift}
            onDone={() => setEditingId(null)}
          />
        ) : (
          <div
            key={shift.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-ink-900/8 bg-white px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-ink-900">{shift.name}</span>
                <Badge tone={shift.isActive ? "success" : "neutral"}>
                  {shift.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-ink-900/50">
                {fmtTime(shift.startTime)} – {fmtTime(shift.endTime)}
                {shift._count.employees > 0 && (
                  <span className="ml-2 text-ink-900/35">
                    · {shift._count.employees} employee{shift._count.employees !== 1 ? "s" : ""}
                  </span>
                )}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setEditingId(shift.id)}
                className="rounded-lg p-1.5 text-ink-900/40 hover:bg-sand-100 hover:text-ink-900"
                aria-label={`Edit ${shift.name}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleToggleActive(shift.id, shift.isActive)}
                  className="rounded-lg p-1.5 text-ink-900/40 hover:bg-sand-100 hover:text-ink-900 disabled:opacity-50"
                  aria-label={shift.isActive ? `Deactivate ${shift.name}` : `Activate ${shift.name}`}
                  title={shift.isActive ? "Deactivate" : "Activate"}
                >
                  <Power className="h-3.5 w-3.5" />
                </button>
            </div>
          </div>
        )
      )}

      {/* Create form */}
      {showCreate && (
        <ShiftForm onDone={() => setShowCreate(false)} />
      )}

      {/* Add button */}
      {!showCreate && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setShowCreate(true)}
          className="mt-1"
        >
          <Plus className="h-3.5 w-3.5" />
          Add shift
        </Button>
      )}
    </div>
  );
}
