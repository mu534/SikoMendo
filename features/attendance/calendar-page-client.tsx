"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, Edit, CheckCircle2, XCircle, CalendarDays } from "lucide-react";
import { createCalendarEntry, updateCalendarEntry, deleteCalendarEntry } from "./calendar-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldGroup, Select } from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import type { CalendarType } from "@prisma/client";
import type { listCalendarEntries } from "./calendar-queries";

type CalendarEntry = Awaited<ReturnType<typeof listCalendarEntries>>[number];

// ── Calendar type display helpers ─────────────────────────────────────────────

const CALENDAR_TYPE_LABELS: Record<CalendarType, { en: string; tone: "neutral" | "brand" | "warning" | "success" | "danger" }> = {
  PUBLIC_HOLIDAY:      { en: "Public Holiday",      tone: "brand"    },
  RELIGIOUS_HOLIDAY:   { en: "Religious Holiday",   tone: "success"  },
  ORG_HOLIDAY:         { en: "Org Holiday",         tone: "warning"  },
  SPECIAL_NON_WORKING: { en: "Special Non-Working", tone: "neutral"  },
  SPECIAL_WORKING:     { en: "Special Working",     tone: "success"  },
};

const CALENDAR_TYPES: CalendarType[] = [
  "PUBLIC_HOLIDAY",
  "RELIGIOUS_HOLIDAY",
  "ORG_HOLIDAY",
  "SPECIAL_NON_WORKING",
  "SPECIAL_WORKING",
];

// ── Add/Edit form ─────────────────────────────────────────────────────────────

function CalendarEntryForm({
  editingEntry,
  onCancel,
}: {
  editingEntry: CalendarEntry | null;
  onCancel: () => void;
}) {
  const isEditing = !!editingEntry;

  // For editing, bind the id into the action
  const action = isEditing
    ? updateCalendarEntry.bind(null, editingEntry.id)
    : createCalendarEntry;

  const [state, formAction, isPending] = useActionState(action, null);

  const didSucceed = state?.success === true;
  const error      = state && !state.success ? state.error.message : null;

  return (
    <Card className="p-5">
      <h3 className="font-display text-base font-semibold text-ink-900 mb-4">
        {isEditing ? "Edit Calendar Entry" : "Add Calendar Entry"}
      </h3>

      {didSucceed && (
        <div role="status" className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-800 mb-4">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          Calendar entry {isEditing ? "updated" : "created"} successfully.
        </div>
      )}
      {error && (
        <div role="alert" className="flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700 mb-4">
          <XCircle className="h-4 w-4 shrink-0 text-red-500" />
          {error}
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="cal-date">Date <span className="text-red-500">*</span></Label>
            <Input
              id="cal-date"
              name="date"
              type="date"
              defaultValue={
                editingEntry
                  ? new Date(editingEntry.date).toISOString().slice(0, 10)
                  : ""
              }
              required
              className="w-full"
            />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="cal-calendarType">Type <span className="text-red-500">*</span></Label>
            <Select
              id="cal-calendarType"
              name="calendarType"
              defaultValue={editingEntry?.calendarType ?? "PUBLIC_HOLIDAY"}
              required
              className="w-full"
            >
              {CALENDAR_TYPES.map((ct) => (
                <option key={ct} value={ct}>
                  {CALENDAR_TYPE_LABELS[ct].en}
                </option>
              ))}
            </Select>
          </FieldGroup>
        </div>

        <FieldGroup>
          <Label htmlFor="cal-name">Name <span className="text-red-500">*</span></Label>
          <Input
            id="cal-name"
            name="name"
            type="text"
            defaultValue={editingEntry?.name ?? ""}
            required
            placeholder="e.g. Ethiopian New Year"
            className="w-full"
          />
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="cal-description">Description</Label>
          <Input
            id="cal-description"
            name="description"
            type="text"
            defaultValue={editingEntry?.description ?? ""}
            placeholder="Optional notes"
            className="w-full"
          />
        </FieldGroup>

        <FieldGroup>
          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-ink-900">
            <input
              type="checkbox"
              name="isWorkingDay"
              defaultChecked={editingEntry?.isWorkingDay ?? false}
              className="h-4 w-4 rounded border-ink-900/25 accent-brand-700"
            />
            Special working day (absence detection still fires on this date)
          </label>
          <p className="mt-1 text-xs text-ink-900/45">
            Leave unchecked for holidays and non-working days (absence detection skips these).
          </p>
        </FieldGroup>

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={isPending} size="md">
            {isPending ? "Saving…" : isEditing ? "Update Entry" : "Add Entry"}
          </Button>
          <Button type="button" variant="secondary" size="md" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ── Delete confirmation ───────────────────────────────────────────────────────

function DeleteButton({ id }: { id: string }) {
  const [confirmed, setConfirmed] = useState(false);

  if (!confirmed) {
    return (
      <button
        type="button"
        onClick={() => setConfirmed(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
        aria-label="Delete calendar entry"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </button>
    );
  }

  async function handleDelete() {
    await deleteCalendarEntry(id);
    setConfirmed(false);
  }

  return (
    <div className="flex items-center gap-2">
      <form action={handleDelete}>
        <button
          type="submit"
          className="text-xs font-medium text-red-700 underline"
        >
          Confirm
        </button>
      </form>
      <button
        type="button"
        onClick={() => setConfirmed(false)}
        className="text-xs text-ink-900/50 hover:underline"
      >
        Cancel
      </button>
    </div>
  );
}

// ── Main page client ──────────────────────────────────────────────────────────

export function CalendarPageClient({
  entries,
}: {
  entries: CalendarEntry[];
}) {
  const [showForm, setShowForm]       = useState(false);
  const [editingEntry, setEditingEntry] = useState<CalendarEntry | null>(null);

  function openAdd() {
    setEditingEntry(null);
    setShowForm(true);
  }

  function openEdit(entry: CalendarEntry) {
    setEditingEntry(entry);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingEntry(null);
  }

  return (
    <div className="space-y-6">
      {/* Add button */}
      {!showForm && (
        <div className="flex justify-end">
          <Button type="button" size="md" onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Add Calendar Entry
          </Button>
        </div>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <CalendarEntryForm editingEntry={editingEntry} onCancel={closeForm} />
      )}

      {/* Entries table */}
      <Card>
        <Table>
          <THead>
            <TH>Date</TH>
            <TH>Name</TH>
            <TH>Type</TH>
            <TH>Working Day?</TH>
            <TH>Description</TH>
            <TH>Actions</TH>
          </THead>
          <TBody>
            {entries.length === 0 && (
              <EmptyRow colSpan={6}>
                <CalendarDays className="mx-auto mb-2 h-8 w-8 text-ink-900/20" />
                No calendar entries yet. Add public holidays and special days above.
              </EmptyRow>
            )}
            {entries.map((entry) => {
              const typeMeta = CALENDAR_TYPE_LABELS[entry.calendarType];
              const dateStr  = new Date(entry.date).toISOString().slice(0, 10);

              return (
                <TR key={entry.id}>
                  <TD>{dateStr}</TD>
                  <TD className="font-medium">{entry.name}</TD>
                  <TD>
                    <Badge tone={typeMeta?.tone ?? "neutral"}>
                      {typeMeta?.en ?? entry.calendarType}
                    </Badge>
                  </TD>
                  <TD>
                    {entry.isWorkingDay ? (
                      <Badge tone="success">Yes</Badge>
                    ) : (
                      <Badge tone="neutral">No</Badge>
                    )}
                  </TD>
                  <TD className="text-ink-900/60">{entry.description ?? "—"}</TD>
                  <TD>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => openEdit(entry)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                        aria-label={`Edit ${entry.name}`}
                      >
                        <Edit className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <DeleteButton id={entry.id} />
                    </div>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
