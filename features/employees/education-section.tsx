"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
import { getInstitutionList, type InstitutionEntry } from "./education-institutions";

// ─── Label helper ─────────────────────────────────────────────────────────────
//
// Using a component instead of JSX text+element siblings inside <label> avoids
// the React/Turbopack hydration mismatch caused by whitespace text nodes being
// serialised differently between SSR and client hydration.

function FL({
  id,
  text,
  req,
  soft,
  opt,
  hint,
}: {
  id: string;
  text: string;
  req?: boolean;
  soft?: boolean;
  opt?: boolean;
  hint?: string;
}) {
  return (
    <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink-900">
      <span>{text}</span>
      {req  ? <span className="ml-0.5 text-red-500 text-sm"     aria-hidden="true">*</span> : null}
      {soft ? <span className="ml-0.5 text-red-400 text-xs"     aria-hidden="true">*</span> : null}
      {opt  ? <span className="ml-1 text-xs font-normal text-ink-900/40">(optional)</span>    : null}
      {hint ? <span className="ml-1 text-xs font-normal text-ink-900/40">{hint}</span>        : null}
    </label>
  );
}

// ─── Display labels ───────────────────────────────────────────────────────────

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

// Computed once at module load — stable within a single SSR + hydration cycle.
const CURRENT_YEAR = new Date().getFullYear();

// ─── Types ────────────────────────────────────────────────────────────────────

type InstType  = (typeof INSTITUTION_TYPES)[number];
type EduLevel  = (typeof ALL_EDUCATION_LEVELS)[number];
type RecordErrors = Partial<Record<keyof EducationRecordInput, string>>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function suggestInstType(level: EduLevel): InstType | null {
  const compat = COMPATIBLE_INSTITUTION_TYPES[level] ?? [];
  const preferred: InstType[] = ["UNIVERSITY", "COLLEGE", "TVET", "HIGH_SCHOOL", "OTHER"];
  return preferred.find((t) => compat.includes(t)) ?? compat[0] ?? null;
}

function emptyRecord(): EducationRecordInput {
  return {
    educationLevel:      "BACHELOR",
    fieldOfStudy:        null,
    institutionType:     "UNIVERSITY",
    institutionName:     null,
    graduationYear:      null,
    qualificationStatus: null,
  };
}

// ─── Searchable institution combobox ─────────────────────────────────────────

function InstitutionCombobox({
  id,
  institutions,
  value,
  onChange,
  placeholder = "Search institution\u2026",
}: {
  id: string;
  institutions: InstitutionEntry[];
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
}) {
  const [query,     setQuery]     = useState("");
  const [open,      setOpen]      = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const listRef  = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lbId     = `${id}-lb`;

  const selectedInst   = value ? (institutions.find((i) => i.name === value) ?? null) : null;
  const isManualValue  = value !== null && selectedInst === null;

  const filtered = query.trim() === ""
    ? institutions.slice(0, 20)
    : institutions
        .filter((i) =>
          i.name.toLowerCase().includes(query.toLowerCase()) ||
          (i.location?.toLowerCase() ?? "").includes(query.toLowerCase())
        )
        .slice(0, 20);

  const exactMatch    = institutions.some((i) => i.name.toLowerCase() === query.trim().toLowerCase());
  const showManual    = query.trim().length > 0 && !exactMatch;
  const totalOptions  = filtered.length + (showManual ? 1 : 0) + 1;

  function pick(name: string) {
    onChange(name); setQuery(""); setOpen(false); setActiveIdx(-1);
  }
  function clear() {
    onChange(null); setQuery(""); setActiveIdx(-1); inputRef.current?.focus();
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") { setOpen(true); e.preventDefault(); }
      return;
    }
    if (e.key === "Escape")     { setOpen(false); setActiveIdx(-1); return; }
    if (e.key === "ArrowDown")  { e.preventDefault(); setActiveIdx((n) => Math.min(n + 1, totalOptions - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((n) => Math.max(n - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx === 0) { onChange(null); setQuery(""); setOpen(false); setActiveIdx(-1); return; }
      const fi = activeIdx - 1;
      if (fi < filtered.length) pick(filtered[fi]!.name);
      else if (showManual && fi === filtered.length) pick(query.trim());
    }
  }

  useEffect(() => {
    if (activeIdx >= 0 && listRef.current) {
      (listRef.current.children[activeIdx] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIdx]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-900/35" aria-hidden="true" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={open ? lbId : undefined}
          aria-activedescendant={open && activeIdx >= 0 ? `${lbId}-${activeIdx}` : undefined}
          placeholder={value ? (selectedInst?.name ?? value) : placeholder}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setActiveIdx(-1); }}
          onBlur={() => setTimeout(() => { setOpen(false); setActiveIdx(-1); }, 180)}
          onKeyDown={onKey}
          className="w-full rounded-lg border border-ink-900/15 bg-white py-2.5 pl-9 pr-8 text-sm text-ink-900 placeholder:text-ink-900/40 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-900/30" aria-hidden="true" />
      </div>

      {value !== null && !open && query === "" && (
        <div className="mt-1.5 flex items-center justify-between rounded-lg border border-ink-900/8 bg-sand-50 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink-900">{isManualValue ? value : (selectedInst?.name ?? value)}</p>
            {selectedInst?.location && <p className="text-xs text-ink-900/45">{selectedInst.location}</p>}
            {isManualValue && <p className="text-xs text-ink-900/40 italic">Manually entered</p>}
          </div>
          <button type="button" onClick={clear} className="ml-3 shrink-0 text-xs font-medium text-ink-900/40 hover:text-ink-900" aria-label="Remove institution selection">
            Remove
          </button>
        </div>
      )}

      {open && (
        <ul ref={listRef} id={lbId} role="listbox" aria-label="Institution options"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-ink-900/10 bg-white py-1 shadow-lg shadow-ink-900/8">
          <li id={`${lbId}-0`} role="option" aria-selected={value === null}
            onMouseDown={() => { onChange(null); setQuery(""); setOpen(false); setActiveIdx(-1); }}
            className={`cursor-pointer px-3 py-2 text-sm text-ink-900/45 hover:bg-sand-50${activeIdx === 0 ? " bg-sand-50" : ""}`}>
            &mdash; Not specified &mdash;
          </li>
          {filtered.map((inst, i) => (
            <li key={inst.name} id={`${lbId}-${i + 1}`} role="option" aria-selected={value === inst.name}
              onMouseDown={() => pick(inst.name)}
              className={`cursor-pointer px-3 py-2.5 hover:bg-sand-50${value === inst.name ? " bg-brand-50" : ""}${activeIdx === i + 1 ? " bg-sand-50" : ""}`}>
              <p className="text-sm font-medium text-ink-900">{inst.name}</p>
              {inst.location ? <p className="text-xs text-ink-900/45">{inst.location}</p> : null}
            </li>
          ))}
          {filtered.length === 0 && !showManual && (
            <li className="px-3 py-3 text-sm text-ink-900/40 text-center">No institutions found for &ldquo;{query}&rdquo;</li>
          )}
          {showManual && (
            <li id={`${lbId}-${filtered.length + 1}`} role="option" aria-selected={false}
              onMouseDown={() => pick(query.trim())}
              className={`cursor-pointer border-t border-ink-900/8 px-3 py-2.5 hover:bg-sand-50${activeIdx === filtered.length + 1 ? " bg-sand-50" : ""}`}>
              <p className="text-sm font-medium text-ink-900">Use &ldquo;<span className="text-brand-700">{query.trim()}</span>&rdquo;</p>
              <p className="text-xs text-ink-900/45">Not in directory &mdash; save as entered</p>
            </li>
          )}
          {institutions.length > 20 && filtered.length === 20 && query.trim() === "" && (
            <li className="px-3 py-1.5 text-xs text-ink-900/35 text-center">Type to narrow the list ({institutions.length} institutions)</li>
          )}
        </ul>
      )}
    </div>
  );
}

// ─── Per-qualification form ───────────────────────────────────────────────────

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
  onChange: (u: EducationRecordInput) => void;
  onRemove: () => void;
  errors: RecordErrors;
  canRemove: boolean;
}) {
  // Use index-based IDs instead of useId() to avoid SSR/client prefix mismatch
  // (React 19 SSR generates "_R_nnn" but client hydration generates "_r_nnn").
  const f = (field: string) => `edu-${index}-${field}`;

  const level        = record.educationLevel as EduLevel;
  const compat       = COMPATIBLE_INSTITUTION_TYPES[level] ?? [...INSTITUTION_TYPES];
  const instType     = record.institutionType as InstType | null;
  const instList     = getInstitutionList(instType);
  const isSchool     = level === "HIGH_SCHOOL" || level === "PRIMARY" || level === "SECONDARY";
  const isCompleted  = record.qualificationStatus === "COMPLETED";
  const isInProgress = record.qualificationStatus === "IN_PROGRESS";

  function onLevel(v: string) {
    const lvl    = v as EduLevel;
    const compat2 = COMPATIBLE_INSTITUTION_TYPES[lvl] ?? [];
    let newType: InstType | null = instType;
    if (instType && !compat2.includes(instType)) newType = suggestInstType(lvl);
    else if (!instType) newType = suggestInstType(lvl);
    const typeChanged = newType !== instType;
    onChange({ ...record, educationLevel: lvl, institutionType: newType, institutionName: typeChanged ? null : record.institutionName });
  }

  function onType(v: string) {
    onChange({ ...record, institutionType: (v || null) as InstType | null, institutionName: null });
  }

  function onYear(v: string) {
    const t = v.trim();
    if (t === "") { onChange({ ...record, graduationYear: null }); return; }
    const n = parseInt(t, 10);
    onChange({ ...record, graduationYear: isNaN(n) ? null : n });
  }

  const showHeader = index > 0 || canRemove;

  return (
    <div className="relative rounded-lg border border-ink-900/10 bg-sand-50/50 p-4">
      {showHeader ? (
        <div className="mb-3 flex items-center justify-between">
          {index > 0 ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/40">Qualification {index + 1}</p>
          ) : (
            <span />
          )}
          {canRemove ? (
            <button type="button" onClick={onRemove}
              className="flex h-7 w-7 items-center justify-center rounded-md text-ink-900/35 hover:bg-red-50 hover:text-red-500 transition-colors"
              aria-label={`Remove qualification ${index + 1}`}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Row 1 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldGroup>
          <FL id={f("level")} text="Education Level" req />
          <Select id={f("level")} value={record.educationLevel} onChange={(e) => onLevel(e.target.value)}>
            {EDUCATION_LEVELS.map((lvl) => (
              <option key={lvl} value={lvl}>{EDUCATION_LEVEL_LABELS[lvl]}</option>
            ))}
            {(record.educationLevel === "PRIMARY" || record.educationLevel === "SECONDARY") ? (
              <option key={record.educationLevel} value={record.educationLevel}>{EDUCATION_LEVEL_LABELS[record.educationLevel]}</option>
            ) : null}
          </Select>
          {errors.educationLevel ? <FieldError>{errors.educationLevel}</FieldError> : null}
        </FieldGroup>

        <FieldGroup>
          <FL id={f("field")} text="Field of Study" opt={isSchool} />
          <Input id={f("field")} placeholder={isSchool ? "e.g. General Education" : "e.g. Computer Science"}
            value={record.fieldOfStudy ?? ""}
            onChange={(e) => onChange({ ...record, fieldOfStudy: e.target.value || null })} />
          {errors.fieldOfStudy ? <FieldError>{errors.fieldOfStudy}</FieldError> : null}
        </FieldGroup>
      </div>

      {/* Row 2 */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldGroup>
          <FL id={f("instType")} text="Institution Type" />
          <Select id={f("instType")} value={record.institutionType ?? ""} onChange={(e) => onType(e.target.value)}>
            <option value="">Not specified</option>
            {INSTITUTION_TYPES.filter((t) => compat.includes(t)).map((t) => (
              <option key={t} value={t}>{INSTITUTION_TYPE_LABELS[t]}</option>
            ))}
          </Select>
          {errors.institutionType ? <FieldError>{errors.institutionType}</FieldError> : null}
        </FieldGroup>

        <FieldGroup>
          <FL id={f("instName")} text="Institution Name" soft={isCompleted && instType !== null} />
          {instList.length > 0 ? (
            <InstitutionCombobox id={f("instName")} institutions={instList}
              value={record.institutionName ?? null}
              onChange={(v) => onChange({ ...record, institutionName: v })}
              placeholder={`Search ${INSTITUTION_TYPE_LABELS[instType ?? ""] ?? "institution"}\u2026`} />
          ) : (
            <Input id={f("instName")}
              placeholder={instType === "HIGH_SCHOOL" ? "Enter school name" : "Enter institution name"}
              value={record.institutionName ?? ""}
              onChange={(e) => onChange({ ...record, institutionName: e.target.value || null })} />
          )}
          {errors.institutionName ? <FieldError>{errors.institutionName}</FieldError> : null}
        </FieldGroup>
      </div>

      {/* Row 3 */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldGroup>
          <FL id={f("year")} text="Graduation Year" hint="(G.C.)" />
          <Input id={f("year")} type="number" inputMode="numeric"
            min={1950} max={isCompleted ? CURRENT_YEAR : CURRENT_YEAR + 10} step={1}
            placeholder={`e.g. ${CURRENT_YEAR - 3}`}
            value={record.graduationYear != null ? String(record.graduationYear) : ""}
            onChange={(e) => onYear(e.target.value)}
            aria-describedby={f("year-hint")} />
          <p id={f("year-hint")} className="mt-1 text-xs text-ink-900/40">
            {isInProgress ? "Not required for in-progress qualifications." : "Leave empty if year is unknown."}
          </p>
          {errors.graduationYear ? <FieldError>{errors.graduationYear}</FieldError> : null}
        </FieldGroup>

        <FieldGroup>
          <FL id={f("status")} text="Qualification Status" />
          <Select id={f("status")} value={record.qualificationStatus ?? ""}
            onChange={(e) => onChange({ ...record, qualificationStatus: (e.target.value || null) as EducationRecordInput["qualificationStatus"] })}>
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

// ─── Education section ────────────────────────────────────────────────────────

export type EducationSectionProps = {
  initialRecords?: EducationRecordInput[];
  hiddenInputName?: string;
};

export function EducationSection({ initialRecords, hiddenInputName = "educations" }: EducationSectionProps) {
  const initRecords = initialRecords && initialRecords.length > 0 ? initialRecords : [emptyRecord()];

  const [records,     setRecords]     = useState<EducationRecordInput[]>(initRecords);
  const [fieldErrors, setFieldErrors] = useState<RecordErrors[]>(() => initRecords.map(() => ({})));

  const updateRecord = useCallback((idx: number, updated: EducationRecordInput) => {
    setRecords((prev) => prev.map((r, i) => (i === idx ? updated : r)));
    setFieldErrors((prev) => prev.map((e, i) => (i === idx ? {} : e)));
  }, []);

  const removeRecord = useCallback((idx: number) => {
    setRecords((prev) => prev.filter((_, i) => i !== idx));
    setFieldErrors((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  function addRecord() {
    setRecords((prev) => [...prev, emptyRecord()]);
    setFieldErrors((prev) => [...prev, {}]);
  }

  const [serialised, setSerialised] = useState<string>(() =>
    JSON.stringify(initRecords.map((r) => ({
      educationLevel:      r.educationLevel,
      fieldOfStudy:        r.fieldOfStudy        ?? null,
      institutionType:     r.institutionType      ?? null,
      institutionName:     r.institutionName      ?? null,
      graduationYear:      r.graduationYear       ?? null,
      qualificationStatus: r.qualificationStatus  ?? null,
    })))
  );

  useEffect(() => {
    setSerialised(JSON.stringify(records.map((r) => ({
      educationLevel:      r.educationLevel,
      fieldOfStudy:        r.fieldOfStudy        ?? null,
      institutionType:     r.institutionType      ?? null,
      institutionName:     r.institutionName      ?? null,
      graduationYear:      r.graduationYear       ?? null,
      qualificationStatus: r.qualificationStatus  ?? null,
    }))));
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
            onChange={(u) => updateRecord(idx, u)}
            onRemove={() => removeRecord(idx)}
            errors={fieldErrors[idx] ?? {}}
            canRemove={records.length > 1}
          />
        ))}
      </div>
      <button type="button" onClick={addRecord}
        className="mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-ink-900/20 px-4 py-2.5 text-sm font-medium text-ink-900/60 hover:border-brand-400 hover:text-brand-700 transition-colors">
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add Another Qualification
      </button>
      <input type="hidden" name={hiddenInputName} value={serialised} />
    </div>
  );
}
