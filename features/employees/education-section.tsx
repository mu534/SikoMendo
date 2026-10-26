"use client";

import { useState, useId } from "react";
import { GraduationCap, Plus, Trash2, Search } from "lucide-react";
import { Input, Label, Select, FieldGroup, FieldError } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "./section-header";
import {
  EDUCATION_LEVELS,
  INSTITUTION_TYPES,
  QUALIFICATION_STATUSES,
  type EducationRecordInput,
} from "./schemas";
import {
  getInstitutionList,
  type InstitutionEntry,
} from "./education-institutions";

// ── Human-readable labels ─────────────────────────────────────────────────────

const EDUCATION_LEVEL_LABELS: Record<string, string> = {
  PRIMARY:     "Primary",
  SECONDARY:   "Secondary",
  HIGH_SCHOOL: "High School",
  CERTIFICATE: "Certificate",
  DIPLOMA:     "Diploma",
  BACHELOR:    "Bachelor's Degree",
  MASTER:      "Master's Degree",
  PHD:         "Doctoral Degree (PhD)",
  OTHER:       "Other",
};

const INSTITUTION_TYPE_LABELS: Record<string, string> = {
  HIGH_SCHOOL: "High School",
  UNIVERSITY:  "University",
  COLLEGE:     "College",
  TVET:        "TVET Institution",
  OTHER:       "Other",
};

const QUALIFICATION_STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: "In Progress",
  COMPLETED:   "Completed",
};

const CURRENT_YEAR = new Date().getFullYear();

// ── Empty record factory ──────────────────────────────────────────────────────

function emptyRecord(): EducationRecordInput {
  return {
    educationLevel:      "BACHELOR",
    fieldOfStudy:        null,
    institutionType:     null,
    institutionName:     null,
    graduationYear:      null,
    qualificationStatus: null,
  };
}

// ── Searchable institution combobox ──────────────────────────────────────────

function InstitutionCombobox({
  id,
  institutions,
  value,
  onChange,
  disabled,
}: {
  id: string;
  institutions: InstitutionEntry[];
  value: string | null;
  onChange: (v: string | null) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered =
    query.trim() === ""
      ? institutions.slice(0, 15)
      : institutions
          .filter((inst) =>
            inst.name.toLowerCase().includes(query.toLowerCase()) ||
            (inst.location?.toLowerCase() ?? "").includes(query.toLowerCase())
          )
          .slice(0, 15);

  const selectedInst = institutions.find((i) => i.name === value) ?? null;
  const displayPlaceholder = selectedInst
    ? selectedInst.name
    : "Search institution…";

  return (
    <div className="relative">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-900/35"
          aria-hidden="true"
        />
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label="Search institution"
          disabled={disabled}
          placeholder={displayPlaceholder}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="w-full rounded-lg border border-ink-900/15 bg-white py-2.5 pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-900/40 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-sand-100 disabled:text-ink-900/50"
        />
      </div>

      {/* Selected institution chip (shown when closed) */}
      {selectedInst && !open && (
        <div className="mt-1.5 flex items-center justify-between rounded-lg border border-ink-900/8 bg-sand-50 px-3 py-2">
          <div>
            <p className="text-sm font-medium text-ink-900">{selectedInst.name}</p>
            {selectedInst.location && (
              <p className="text-xs text-ink-900/45">{selectedInst.location}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => { onChange(null); setQuery(""); }}
            className="ml-2 shrink-0 text-xs font-medium text-ink-900/40 hover:text-ink-900"
            aria-label="Remove institution selection"
          >
            Remove
          </button>
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <ul
          role="listbox"
          aria-label="Institution options"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-ink-900/10 bg-white py-1 shadow-lg shadow-ink-900/8"
        >
          <li
            role="option"
            aria-selected={!selectedInst}
            onMouseDown={() => { onChange(null); setQuery(""); setOpen(false); }}
            className="cursor-pointer px-3 py-2 text-sm text-ink-900/45 hover:bg-sand-50"
          >
            — Not specified —
          </li>
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-ink-900/40">No institutions found.</li>
          )}
          {filtered.map((inst) => (
            <li
              key={inst.name}
              role="option"
              aria-selected={selectedInst?.name === inst.name}
              onMouseDown={() => { onChange(inst.name); setQuery(""); setOpen(false); }}
              className={`cursor-pointer px-3 py-2.5 hover:bg-sand-50 ${
                selectedInst?.name === inst.name ? "bg-brand-50" : ""
              }`}
            >
              <p className="text-sm font-medium text-ink-900">{inst.name}</p>
              {inst.location && (
                <p className="text-xs text-ink-900/45">{inst.location}</p>
              )}
            </li>
          ))}
          {institutions.length > 15 && filtered.length === 15 && (
            <li className="px-3 py-1.5 text-xs text-ink-900/35">Type to narrow results…</li>
          )}
        </ul>
      )}
    </div>
  );
}

// ── Per-record form ───────────────────────────────────────────────────────────

type RecordErrors = Partial<Record<keyof EducationRecordInput, string>>;

function EducationRecordForm({
  index,
  record,
  onChange,
  onRemove,
  errors,
  isOnly,
}: {
  index: number;
  record: EducationRecordInput;
  onChange: (updated: EducationRecordInput) => void;
  onRemove: () => void;
  errors: RecordErrors;
  isOnly: boolean;
}) {
  const uid = useId();
  const idFor = (field: string) => `edu-${uid}-${field}`;

  const institutionList = getInstitutionList(record.institutionType);
  const useFreeText = record.institutionType === "HIGH_SCHOOL" || record.institutionType === "OTHER";
  const useCombobox = !useFreeText && institutionList.length > 0;

  // When institution type changes, clear institution name so stale values don't persist
  function handleTypeChange(type: string) {
    onChange({ ...record, institutionType: (type || null) as EducationRecordInput["institutionType"], institutionName: null });
  }

  // Graduation year: treat empty string as null
  function handleYearChange(val: string) {
    const trimmed = val.trim();
    if (trimmed === "") {
      onChange({ ...record, graduationYear: null });
    } else {
      const n = parseInt(trimmed, 10);
      onChange({ ...record, graduationYear: isNaN(n) ? null : n });
    }
  }

  const isHighSchool = record.educationLevel === "HIGH_SCHOOL" || record.educationLevel === "PRIMARY" || record.educationLevel === "SECONDARY";

  return (
    <div className="relative rounded-lg border border-ink-900/10 bg-sand-50/50 p-4">
      {/* Remove button */}
      {!isOnly && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md text-ink-900/35 hover:bg-red-50 hover:text-red-500 transition-colors"
          aria-label={`Remove qualification ${index + 1}`}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}

      {index > 0 && (
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-900/40">
          Qualification {index + 1}
        </p>
      )}

      {/* Row 1: Education Level + Field of Study */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldGroup>
          <Label htmlFor={idFor("level")}>
            Education Level <span className="text-red-500" aria-hidden="true">*</span>
          </Label>
          <Select
            id={idFor("level")}
            value={record.educationLevel ?? ""}
            onChange={(e) => onChange({ ...record, educationLevel: e.target.value as EducationRecordInput["educationLevel"] })}
          >
            {EDUCATION_LEVELS.map((lvl) => (
              <option key={lvl} value={lvl}>{EDUCATION_LEVEL_LABELS[lvl]}</option>
            ))}
          </Select>
          {errors.educationLevel && <FieldError>{errors.educationLevel}</FieldError>}
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor={idFor("field")}>
            Field of Study
            {isHighSchool && (
              <span className="ml-1 text-xs font-normal text-ink-900/40">(optional)</span>
            )}
          </Label>
          <Input
            id={idFor("field")}
            placeholder={isHighSchool ? "e.g. General Education" : "e.g. Computer Science"}
            value={record.fieldOfStudy ?? ""}
            onChange={(e) => onChange({ ...record, fieldOfStudy: e.target.value || null })}
          />
          {errors.fieldOfStudy && <FieldError>{errors.fieldOfStudy}</FieldError>}
        </FieldGroup>
      </div>

      {/* Row 2: Institution Type + Institution Name */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldGroup>
          <Label htmlFor={idFor("instType")}>Institution Type</Label>
          <Select
            id={idFor("instType")}
            value={record.institutionType ?? ""}
            onChange={(e) => handleTypeChange(e.target.value)}
          >
            <option value="">Not specified</option>
            {INSTITUTION_TYPES.map((t) => (
              <option key={t} value={t}>{INSTITUTION_TYPE_LABELS[t]}</option>
            ))}
          </Select>
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor={idFor("instName")}>Institution Name</Label>
          {useCombobox ? (
            <InstitutionCombobox
              id={idFor("instName")}
              institutions={institutionList}
              value={record.institutionName ?? null}
              onChange={(v) => onChange({ ...record, institutionName: v })}
            />
          ) : (
            <Input
              id={idFor("instName")}
              placeholder={
                record.institutionType === "HIGH_SCHOOL"
                  ? "Enter school name"
                  : record.institutionType === "OTHER"
                  ? "Enter institution name"
                  : "Enter institution name"
              }
              value={record.institutionName ?? ""}
              onChange={(e) => onChange({ ...record, institutionName: e.target.value || null })}
            />
          )}
          {errors.institutionName && <FieldError>{errors.institutionName}</FieldError>}
        </FieldGroup>
      </div>

      {/* Row 3: Graduation Year + Qualification Status */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldGroup>
          <Label htmlFor={idFor("year")}>
            Graduation Year
            <span className="ml-1 text-xs font-normal text-ink-900/40">(G.C.)</span>
          </Label>
          <Input
            id={idFor("year")}
            type="number"
            min={1950}
            max={record.qualificationStatus === "COMPLETED" ? CURRENT_YEAR : CURRENT_YEAR + 10}
            step={1}
            placeholder={`e.g. ${CURRENT_YEAR - 2}`}
            value={record.graduationYear != null ? String(record.graduationYear) : ""}
            onChange={(e) => handleYearChange(e.target.value)}
          />
          <p className="mt-1 text-xs text-ink-900/40">
            Leave empty if in progress or year is unknown.
          </p>
          {errors.graduationYear && <FieldError>{errors.graduationYear}</FieldError>}
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor={idFor("status")}>Qualification Status</Label>
          <Select
            id={idFor("status")}
            value={record.qualificationStatus ?? ""}
            onChange={(e) => onChange({ ...record, qualificationStatus: (e.target.value || null) as EducationRecordInput["qualificationStatus"] })}
          >
            <option value="">Not specified</option>
            {QUALIFICATION_STATUSES.map((s) => (
              <option key={s} value={s}>{QUALIFICATION_STATUS_LABELS[s]}</option>
            ))}
          </Select>
        </FieldGroup>
      </div>
    </div>
  );
}

// ── Education section (used inside EmployeeForm) ──────────────────────────────

export type EducationSectionProps = {
  /** Pre-populated records when editing an existing employee. */
  initialRecords?: EducationRecordInput[];
  /** Name of the hidden input that carries the serialised JSON to the server. */
  hiddenInputName?: string;
};

export function EducationSection({
  initialRecords,
  hiddenInputName = "educations",
}: EducationSectionProps) {
  const [records, setRecords] = useState<EducationRecordInput[]>(
    initialRecords && initialRecords.length > 0 ? initialRecords : [emptyRecord()]
  );
  const [fieldErrors, setFieldErrors] = useState<RecordErrors[]>([]);

  function updateRecord(index: number, updated: EducationRecordInput) {
    setRecords((prev) => prev.map((r, i) => (i === index ? updated : r)));
    // Clear errors for the changed record
    setFieldErrors((prev) => {
      const next = [...prev];
      next[index] = {};
      return next;
    });
  }

  function removeRecord(index: number) {
    setRecords((prev) => prev.filter((_, i) => i !== index));
    setFieldErrors((prev) => prev.filter((_, i) => i !== index));
  }

  function addRecord() {
    setRecords((prev) => [...prev, emptyRecord()]);
    setFieldErrors((prev) => [...prev, {}]);
  }

  // Serialise as JSON for the hidden input so it travels through FormData
  const json = JSON.stringify(
    records.map((r) => ({
      educationLevel:      r.educationLevel,
      fieldOfStudy:        r.fieldOfStudy ?? null,
      institutionType:     r.institutionType ?? null,
      institutionName:     r.institutionName ?? null,
      graduationYear:      r.graduationYear ?? null,
      qualificationStatus: r.qualificationStatus ?? null,
    }))
  );

  return (
    <div>
      <SectionHeader icon={GraduationCap} title="Education" />

      <div className="space-y-3">
        {records.map((rec, idx) => (
          <EducationRecordForm
            key={idx}
            index={idx}
            record={rec}
            onChange={(updated) => updateRecord(idx, updated)}
            onRemove={() => removeRecord(idx)}
            errors={fieldErrors[idx] ?? {}}
            isOnly={records.length === 1}
          />
        ))}
      </div>

      {/* Add another */}
      <button
        type="button"
        onClick={addRecord}
        className="mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-ink-900/20 px-4 py-2.5 text-sm font-medium text-ink-900/60 hover:border-brand-400 hover:text-brand-700 transition-colors"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add Another Qualification
      </button>

      {/* Hidden field — carries the serialised JSON through the form submit */}
      <input type="hidden" name={hiddenInputName} value={json} />
    </div>
  );
}
