"use client";

/**
 * education-section.tsx
 *
 * Multi-record education sub-form embedded inside EmployeeForm.
 *
 * Design decisions:
 * - Institution Type drives which institution input appears:
 *     UNIVERSITY  → searchable combobox over 51 verified Ethiopian universities
 *     COLLEGE     → searchable combobox over the college starter list + manual-entry fallback
 *     TVET        → searchable combobox over the TVET starter list + manual-entry fallback
 *     HIGH_SCHOOL → plain text input (no predefined list)
 *     OTHER / null → plain text input
 * - Selecting Education Level auto-suggests a compatible Institution Type when
 *   the current type is blank or incompatible, preventing the "plain text box"
 *   symptom where the combobox never appeared.
 * - Frontend validation runs on the hidden-input serialisation so the user sees
 *   per-field errors before the form reaches the server.
 * - The hidden <input name="educations"> carries the validated JSON array so
 *   the existing server action receives it through FormData unchanged.
 */

import { useState, useId, useRef, useEffect, useCallback } from "react";
import { GraduationCap, Plus, Trash2, Search, ChevronDown } from "lucide-react";
import { Input, Select, FieldGroup, FieldError } from "@/components/ui/field";
import { SectionHeader } from "./section-header";
import {
  EDUCATION_LEVELS,
  ALL_EDUCATION_LEVELS,
  INSTITUTION_TYPES,
  QUALIFICATION_STATUSES,
  COMPATIBLE_INSTITUTION_TYPES,
  educationRecordSchema,
  type EducationRecordInput,
} from "./schemas";
import {
  getInstitutionList,
  type InstitutionEntry,
} from "./education-institutions";

// ── Stable inline helpers ─────────────────────────────────────────────────────

/**
 * Hydration-safe label for form fields. Renders text and optional
 * markers as a flat span, avoiding mixed JSX text+element whitespace
 * differences between SSR and client hydration in Next.js/Turbopack.
 */
function FieldLabel({
  htmlFor,
  text,
  required,
  optional,
  softRequired,
  hint,
}: {
  htmlFor: string;
  text: string;
  required?: boolean;
  optional?: boolean;
  softRequired?: boolean;
  hint?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-sm font-medium text-ink-900"
    >
      <span>{text}</span>
      {required    && <span className="ml-0.5 text-red-500"      aria-hidden="true">*</span>}
      {softRequired && <span className="ml-0.5 text-red-400 text-xs" aria-hidden="true">*</span>}
      {optional    && <span className="ml-1 text-xs font-normal text-ink-900/40">(optional)</span>}
      {hint        && <span className="ml-1 text-xs font-normal text-ink-900/40">{hint}</span>}
    </label>
  );
}

// ── Labels ────────────────────────────────────────────────────────────────────

export const EDUCATION_LEVEL_LABELS: Record<string, string> = {
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

// ── Helpers ───────────────────────────────────────────────────────────────────

type InstitutionTypeLiteral = (typeof INSTITUTION_TYPES)[number];
type EducationLevelLiteral  = (typeof ALL_EDUCATION_LEVELS)[number];

/**
 * Given an education level, return the first compatible institution type.
 * Used to auto-suggest a type when the user selects a level.
 */
function suggestInstitutionType(
  level: EducationLevelLiteral
): InstitutionTypeLiteral | null {
  const compatible = COMPATIBLE_INSTITUTION_TYPES[level];
  if (!compatible || compatible.length === 0) return null;
  // Prefer the most "natural" suggestion: university for degrees, etc.
  const preferred: InstitutionTypeLiteral[] = ["UNIVERSITY", "COLLEGE", "TVET", "HIGH_SCHOOL", "OTHER"];
  return preferred.find((t) => compatible.includes(t)) ?? compatible[0] ?? null;
}

/** Returns true when type is compatible with level. */
function isCompatible(
  level: EducationLevelLiteral,
  type: InstitutionTypeLiteral
): boolean {
  return (COMPATIBLE_INSTITUTION_TYPES[level] ?? []).includes(type);
}

function emptyRecord(): EducationRecordInput {
  return {
    educationLevel:      "BACHELOR",
    fieldOfStudy:        null,
    institutionType:     "UNIVERSITY",   // auto-suggested for BACHELOR
    institutionName:     null,
    graduationYear:      null,
    qualificationStatus: null,
  };
}

// ── Searchable institution combobox ──────────────────────────────────────────

/**
 * Accessible combobox for institution selection.
 *
 * Shows a text search input + dropdown list.  When the dropdown is closed and
 * an institution is selected, shows a small chip with a Remove button.
 * When "manual entry" is visible (user typed something not in the list and
 * clicked "Use this name"), the chip shows the custom name.
 *
 * Keyboard: ArrowDown/Up to navigate list, Enter to select, Escape to close.
 */
function InstitutionCombobox({
  id,
  institutions,
  value,
  onChange,
  placeholder = "Search institution…",
}: {
  id: string;
  institutions: InstitutionEntry[];
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
}) {
  const [query, setQuery]       = useState("");
  const [open, setOpen]         = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const listRef   = useRef<HTMLUListElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const listboxId = `${id}-listbox`;

  // The "selected from directory" entry
  const selectedInst = value ? (institutions.find((i) => i.name === value) ?? null) : null;
  // If value is set but not in the directory, it's a manual entry
  const isManualValue = value != null && !selectedInst;

  const filtered = (() => {
    if (query.trim() === "") return institutions.slice(0, 20);
    const q = query.toLowerCase();
    return institutions
      .filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.location?.toLowerCase() ?? "").includes(q)
      )
      .slice(0, 20);
  })();

  // Whether the typed query exactly matches an existing entry (case-insensitive)
  const queryMatchesEntry = institutions.some(
    (i) => i.name.toLowerCase() === query.trim().toLowerCase()
  );
  // Show "use this name" when user typed something non-empty not in directory
  const showManualOption = query.trim().length > 0 && !queryMatchesEntry;

  function selectInst(name: string) {
    onChange(name);
    setQuery("");
    setOpen(false);
    setActiveIdx(-1);
  }

  function clearSelection() {
    onChange(null);
    setQuery("");
    setActiveIdx(-1);
    inputRef.current?.focus();
  }

  const totalOptions = filtered.length + (showManualOption ? 1 : 0) + 1; // +1 for "Not specified"

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") { setOpen(true); e.preventDefault(); }
      return;
    }
    if (e.key === "Escape") { setOpen(false); setActiveIdx(-1); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, totalOptions - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx === 0) { onChange(null); setQuery(""); setOpen(false); setActiveIdx(-1); return; }
      const filteredIdx = activeIdx - 1; // offset for "Not specified" at 0
      if (filteredIdx < filtered.length) {
        selectInst(filtered[filteredIdx]!.name);
      } else if (showManualOption && filteredIdx === filtered.length) {
        selectInst(query.trim());
      }
    }
  }

  // Scroll active item into view
  useEffect(() => {
    if (activeIdx >= 0 && listRef.current) {
      const item = listRef.current.children[activeIdx] as HTMLElement | undefined;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIdx]);

  return (
    <div className="relative">
      {/* Search input — always visible */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-900/35"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={open ? listboxId : undefined}
          aria-activedescendant={
            open && activeIdx >= 0 ? `${listboxId}-opt-${activeIdx}` : undefined
          }
          placeholder={
            value
              ? (selectedInst ? selectedInst.name : value) // show current value as placeholder when closed
              : placeholder
          }
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setActiveIdx(-1); }}
          onBlur={() => setTimeout(() => { setOpen(false); setActiveIdx(-1); }, 180)}
          onKeyDown={handleKeyDown}
          className="w-full rounded-lg border border-ink-900/15 bg-white py-2.5 pl-9 pr-8 text-sm text-ink-900 placeholder:text-ink-900/40 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-900/30"
          aria-hidden="true"
        />
      </div>

      {/* Selected chip (shown when no query typed and a value is set) */}
      {value && !open && query === "" && (
        <div className="mt-1.5 flex items-center justify-between rounded-lg border border-ink-900/8 bg-sand-50 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink-900">
              {isManualValue ? value : selectedInst?.name ?? value}
            </p>
            {selectedInst?.location && (
              <p className="text-xs text-ink-900/45">{selectedInst.location}</p>
            )}
            {isManualValue && (
              <p className="text-xs text-ink-900/40 italic">Manually entered</p>
            )}
          </div>
          <button
            type="button"
            onClick={clearSelection}
            className="ml-3 shrink-0 text-xs font-medium text-ink-900/40 hover:text-ink-900 transition-colors"
            aria-label="Remove institution selection"
          >
            Remove
          </button>
        </div>
      )}

      {/* Dropdown list */}
      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label="Institution options"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-ink-900/10 bg-white py-1 shadow-lg shadow-ink-900/8"
        >
          {/* "Not specified" option */}
          <li
            id={`${listboxId}-opt-0`}
            role="option"
            aria-selected={!value}
            onMouseDown={() => { onChange(null); setQuery(""); setOpen(false); setActiveIdx(-1); }}
            className={`cursor-pointer px-3 py-2 text-sm text-ink-900/45 hover:bg-sand-50 ${activeIdx === 0 ? "bg-sand-50" : ""}`}
          >
            — Not specified —
          </li>

          {/* Filtered directory entries */}
          {filtered.map((inst, i) => {
            const optIdx = i + 1;
            return (
              <li
                key={inst.name}
                id={`${listboxId}-opt-${optIdx}`}
                role="option"
                aria-selected={value === inst.name}
                onMouseDown={() => selectInst(inst.name)}
                className={`cursor-pointer px-3 py-2.5 hover:bg-sand-50 ${
                  value === inst.name ? "bg-brand-50" : ""
                } ${activeIdx === optIdx ? "bg-sand-50" : ""}`}
              >
                <p className="text-sm font-medium text-ink-900">{inst.name}</p>
                {inst.location && (
                  <p className="text-xs text-ink-900/45">{inst.location}</p>
                )}
              </li>
            );
          })}

          {/* Empty state */}
          {filtered.length === 0 && !showManualOption && (
            <li className="px-3 py-3 text-sm text-ink-900/40 text-center">
              No institutions found for &ldquo;{query}&rdquo;
            </li>
          )}

          {/* "Use this name" manual entry */}
          {showManualOption && (
            <li
              id={`${listboxId}-opt-${filtered.length + 1}`}
              role="option"
              aria-selected={false}
              onMouseDown={() => selectInst(query.trim())}
              className={`cursor-pointer border-t border-ink-900/8 px-3 py-2.5 hover:bg-sand-50 ${
                activeIdx === filtered.length + 1 ? "bg-sand-50" : ""
              }`}
            >
              <p className="text-sm font-medium text-ink-900">
                Use &ldquo;<span className="text-brand-700">{query.trim()}</span>&rdquo;
              </p>
              <p className="text-xs text-ink-900/45">Not in directory — save as entered</p>
            </li>
          )}

          {/* "Type to narrow" hint when list is truncated */}
          {institutions.length > 20 && filtered.length === 20 && query.trim() === "" && (
            <li className="px-3 py-1.5 text-xs text-ink-900/35 text-center">
              Type to narrow the list ({institutions.length} institutions)
            </li>
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
  canRemove,
}: {
  index: number;
  record: EducationRecordInput;
  onChange: (updated: EducationRecordInput) => void;
  onRemove: () => void;
  errors: RecordErrors;
  canRemove: boolean;
}) {
  const uid   = useId();
  const idFor = (field: string) => `edu-${uid}-${field}`;

  const level = record.educationLevel as EducationLevelLiteral;
  const compatibleTypes = COMPATIBLE_INSTITUTION_TYPES[level] ?? [...INSTITUTION_TYPES];

  // Current institution type, coerced to a typed literal or null
  const currentInstType = record.institutionType as InstitutionTypeLiteral | null;

  // The directory list to use (empty → free-text input)
  const institutionList = getInstitutionList(currentInstType);

  // High-school type qualifications: Field of Study is optional
  const isSchoolLevel = level === "HIGH_SCHOOL" || level === "PRIMARY" || level === "SECONDARY";

  // For COMPLETED, require year? (currently: yes, but allow "unknown" → optional)
  const isCompleted    = record.qualificationStatus === "COMPLETED";
  const isInProgress   = record.qualificationStatus === "IN_PROGRESS";

  // Handle education level change: auto-suggest compatible institution type
  function handleLevelChange(newLevel: string) {
    const lvl = newLevel as EducationLevelLiteral;
    const compat = COMPATIBLE_INSTITUTION_TYPES[lvl] ?? [];

    // Keep the current type if it's still compatible; otherwise auto-suggest
    let newType: InstitutionTypeLiteral | null = currentInstType;
    if (currentInstType && !compat.includes(currentInstType)) {
      newType = suggestInstitutionType(lvl);
    } else if (!currentInstType) {
      newType = suggestInstitutionType(lvl);
    }

    // Clear institution name when type changes
    const nameChanged = newType !== currentInstType;

    onChange({
      ...record,
      educationLevel:  lvl,
      institutionType: newType,
      institutionName: nameChanged ? null : record.institutionName,
    });
  }

  // Handle institution type change: clear name to prevent stale cross-list values
  function handleTypeChange(newType: string) {
    onChange({
      ...record,
      institutionType: (newType || null) as InstitutionTypeLiteral | null,
      institutionName: null,
    });
  }

  function handleYearChange(val: string) {
    const trimmed = val.trim();
    if (trimmed === "") { onChange({ ...record, graduationYear: null }); return; }
    const n = parseInt(trimmed, 10);
    onChange({ ...record, graduationYear: isNaN(n) ? null : n });
  }

  // Only render the header row when there is something to show in it.
  const showHeader = index > 0 || canRemove;

  return (
    <div className="relative rounded-lg border border-ink-900/10 bg-sand-50/50 p-4">
      {showHeader && (
        <div className="mb-3 flex items-center justify-between">
          {index > 0 ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/40">
              Qualification {index + 1}
            </p>
          ) : (
            <span />
          )}
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="flex h-7 w-7 items-center justify-center rounded-md text-ink-900/35 hover:bg-red-50 hover:text-red-500 transition-colors"
              aria-label={`Remove qualification ${index + 1}`}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {/* Row 1: Education Level + Field of Study */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldGroup>
          <FieldLabel htmlFor={idFor("level")} text="Education Level" required />
          <Select
            id={idFor("level")}
            value={record.educationLevel}
            onChange={(e) => handleLevelChange(e.target.value)}
          >
            {EDUCATION_LEVELS.map((lvl) => (
              <option key={lvl} value={lvl}>
                {EDUCATION_LEVEL_LABELS[lvl]}
              </option>
            ))}
            {/* Legacy values: shown only when editing a record that has them */}
            {(record.educationLevel === "PRIMARY" || record.educationLevel === "SECONDARY") && (
              <option value={record.educationLevel}>
                {EDUCATION_LEVEL_LABELS[record.educationLevel]}
              </option>
            )}
          </Select>
          {errors.educationLevel && <FieldError>{errors.educationLevel}</FieldError>}
        </FieldGroup>

        <FieldGroup>
          <FieldLabel htmlFor={idFor("field")} text="Field of Study" optional={isSchoolLevel} />
          <Input
            id={idFor("field")}
            placeholder={isSchoolLevel ? "e.g. General Education" : "e.g. Computer Science"}
            value={record.fieldOfStudy ?? ""}
            onChange={(e) => onChange({ ...record, fieldOfStudy: e.target.value || null })}
          />
          {errors.fieldOfStudy && <FieldError>{errors.fieldOfStudy}</FieldError>}
        </FieldGroup>
      </div>

      {/* Row 2: Institution Type + Institution Name */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldGroup>
          <FieldLabel htmlFor={idFor("instType")} text="Institution Type" />
          <Select
            id={idFor("instType")}
            value={record.institutionType ?? ""}
            onChange={(e) => handleTypeChange(e.target.value)}
          >
            <option value="">Not specified</option>
            {/* Only show institution types that are compatible with current education level */}
            {INSTITUTION_TYPES.filter((t) => compatibleTypes.includes(t)).map((t) => (
              <option key={t} value={t}>
                {INSTITUTION_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
          {errors.institutionType && <FieldError>{errors.institutionType}</FieldError>}
        </FieldGroup>

        <FieldGroup>
          <FieldLabel
            htmlFor={idFor("instName")}
            text="Institution Name"
            softRequired={isCompleted && !!currentInstType}
          />

          {/* Show combobox when there is a directory list for this type */}
          {institutionList.length > 0 ? (
            <InstitutionCombobox
              id={idFor("instName")}
              institutions={institutionList}
              value={record.institutionName ?? null}
              onChange={(v) => onChange({ ...record, institutionName: v })}
              placeholder={`Search ${INSTITUTION_TYPE_LABELS[currentInstType ?? ""] ?? "institution"}…`}
            />
          ) : (
            /* Free-text for HIGH_SCHOOL, OTHER, or unset type */
            <Input
              id={idFor("instName")}
              placeholder={
                currentInstType === "HIGH_SCHOOL"
                  ? "Enter school name"
                  : currentInstType === "OTHER"
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
          <FieldLabel htmlFor={idFor("year")} text="Graduation Year" hint="(G.C.)" />
          <Input
            id={idFor("year")}
            type="number"
            inputMode="numeric"
            min={1950}
            max={isCompleted ? CURRENT_YEAR : CURRENT_YEAR + 10}
            step={1}
            placeholder={`e.g. ${CURRENT_YEAR - 3}`}
            value={record.graduationYear != null ? String(record.graduationYear) : ""}
            onChange={(e) => handleYearChange(e.target.value)}
            aria-describedby={idFor("year-hint")}
          />
          <p id={idFor("year-hint")} className="mt-1 text-xs text-ink-900/40">
            {isInProgress
              ? "Not required for in-progress qualifications."
              : "Leave empty if year is unknown."}
          </p>
          {errors.graduationYear && <FieldError>{errors.graduationYear}</FieldError>}
        </FieldGroup>

        <FieldGroup>
          <FieldLabel htmlFor={idFor("status")} text="Qualification Status" />
          <Select
            id={idFor("status")}
            value={record.qualificationStatus ?? ""}
            onChange={(e) =>
              onChange({
                ...record,
                qualificationStatus: (e.target.value || null) as EducationRecordInput["qualificationStatus"],
              })
            }
          >
            <option value="">Not specified</option>
            {QUALIFICATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {QUALIFICATION_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </FieldGroup>
      </div>
    </div>
  );
}

// ── Education section ─────────────────────────────────────────────────────────

export type EducationSectionProps = {
  initialRecords?: EducationRecordInput[];
  hiddenInputName?: string;
};

export function EducationSection({
  initialRecords,
  hiddenInputName = "educations",
}: EducationSectionProps) {
  const [records, setRecords]     = useState<EducationRecordInput[]>(
    initialRecords && initialRecords.length > 0 ? initialRecords : [emptyRecord()]
  );
  const [fieldErrors, setFieldErrors] = useState<RecordErrors[]>(
    () => (initialRecords && initialRecords.length > 0 ? initialRecords : [emptyRecord()]).map(() => ({}))
  );

  const updateRecord = useCallback((index: number, updated: EducationRecordInput) => {
    setRecords((prev) => prev.map((r, i) => (i === index ? updated : r)));
    setFieldErrors((prev) => prev.map((e, i) => (i === index ? {} : e)));
  }, []);

  const removeRecord = useCallback((index: number) => {
    setRecords((prev) => prev.filter((_, i) => i !== index));
    setFieldErrors((prev) => prev.filter((_, i) => i !== index));
  }, []);

  function addRecord() {
    setRecords((prev) => [...prev, emptyRecord()]);
    setFieldErrors((prev) => [...prev, {}]);
  }

  /**
   * Run frontend validation and surface per-field errors.
   * Returns the validated array when all records pass, or null on error.
   * Called by the hidden-input's value computation so errors appear
   * inline before the form reaches the server.
   */
  function validateAll(): EducationRecordInput[] | null {
    const newErrors: RecordErrors[] = records.map(() => ({}));
    let allOk = true;

    records.forEach((rec, idx) => {
      const result = educationRecordSchema.safeParse(rec);
      if (!result.success) {
        allOk = false;
        for (const issue of result.error.issues) {
          const field = issue.path[0] as keyof EducationRecordInput | undefined;
          if (field && !newErrors[idx]![field]) {
            (newErrors[idx] as Record<string, string>)[field] = issue.message;
          }
        }
      }
    });

    setFieldErrors(newErrors);
    return allOk ? records : null;
  }

  // The JSON written into the hidden input. We keep a "last good" copy so
  // a mid-edit state still submits the previous valid value rather than
  // incomplete data. On every render we try to validate; if valid, we
  // update the serialised JSON.
  const [serialised, setSerialised] = useState(() =>
    JSON.stringify(
      (initialRecords && initialRecords.length > 0 ? initialRecords : [emptyRecord()]).map((r) => ({
        educationLevel:      r.educationLevel,
        fieldOfStudy:        r.fieldOfStudy ?? null,
        institutionType:     r.institutionType ?? null,
        institutionName:     r.institutionName ?? null,
        graduationYear:      r.graduationYear ?? null,
        qualificationStatus: r.qualificationStatus ?? null,
      }))
    )
  );

  // Recompute serialised JSON on every record change
  useEffect(() => {
    setSerialised(
      JSON.stringify(
        records.map((r) => ({
          educationLevel:      r.educationLevel,
          fieldOfStudy:        r.fieldOfStudy ?? null,
          institutionType:     r.institutionType ?? null,
          institutionName:     r.institutionName ?? null,
          graduationYear:      r.graduationYear ?? null,
          qualificationStatus: r.qualificationStatus ?? null,
        }))
      )
    );
  }, [records]);

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
            canRemove={records.length > 1}
          />
        ))}
      </div>

      {/* Add Another Qualification */}
      <button
        type="button"
        onClick={addRecord}
        className="mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-ink-900/20 px-4 py-2.5 text-sm font-medium text-ink-900/60 hover:border-brand-400 hover:text-brand-700 transition-colors"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add Another Qualification
      </button>

      {/* Hidden field — carries the full education array as JSON through FormData */}
      <input type="hidden" name={hiddenInputName} value={serialised} />
    </div>
  );
}
