"use client";

/**
 * Live preview panel that dynamically displays attendance status examples
 * based on the current unsaved form values (two-session model).
 *
 * Pure client-side computation — no server calls, no stale data.
 */

import type { RulesFormValues } from "./attendance-rules-form";

const DAY_LABELS: Record<number, string> = {
  1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat", 7: "Sun",
};

function parseTimeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

type TimelineEntry = {
  time: string;
  label: string;
  status: "present" | "absent" | "note";
};

function buildSessionTimeline(
  sessionLabel: string,
  startTime: string,
  deadline: string
): TimelineEntry[] {
  const startMins    = parseTimeToMinutes(startTime);
  const deadlineMins = parseTimeToMinutes(deadline);

  return [
    { time: minutesToTime(startMins),    label: `${sessionLabel} session begins`, status: "note" },
    { time: minutesToTime(deadlineMins), label: `Check-in deadline (Present at/before)`, status: "present" },
    { time: `After ${minutesToTime(deadlineMins)}`, label: "Absent", status: "absent" },
  ];
}

const STATUS_STYLES: Record<string, string> = {
  present: "bg-emerald-50 text-emerald-700 border-emerald-200",
  absent:  "bg-red-50 text-red-700 border-red-200",
  note:    "bg-ink-900/5 text-ink-900/60 border-ink-900/10",
};

const STATUS_LABELS: Record<string, string> = {
  present: "Present",
  absent:  "Absent",
  note:    "",
};

type Props = {
  rules: RulesFormValues;
};

export function PolicyPreview({ rules }: Props) {
  const morningTimeline   = buildSessionTimeline("Morning",   rules.morningStartTime,   rules.morningCheckInDeadline);
  const afternoonTimeline = buildSessionTimeline("Afternoon", rules.afternoonStartTime, rules.afternoonCheckInDeadline);

  return (
    <div className="space-y-5">
      {/* Morning session */}
      <div>
        <p className="mb-2 text-xs font-semibold text-ink-900/50 uppercase tracking-wide">Morning</p>
        <div className="space-y-1.5">
          {morningTimeline.map((entry, i) => (
            <div key={i} className="flex items-baseline gap-3">
              <span className="w-28 shrink-0 text-right text-xs font-mono text-ink-900/55">
                {entry.time}
              </span>
              <span className={["rounded border px-2 py-0.5 text-xs font-medium", STATUS_STYLES[entry.status]].join(" ")}>
                {STATUS_LABELS[entry.status] ? `${STATUS_LABELS[entry.status]} — ${entry.label}` : entry.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Afternoon session */}
      <div>
        <p className="mb-2 text-xs font-semibold text-ink-900/50 uppercase tracking-wide">Afternoon</p>
        <div className="space-y-1.5">
          {afternoonTimeline.map((entry, i) => (
            <div key={i} className="flex items-baseline gap-3">
              <span className="w-28 shrink-0 text-right text-xs font-mono text-ink-900/55">
                {entry.time}
              </span>
              <span className={["rounded border px-2 py-0.5 text-xs font-medium", STATUS_STYLES[entry.status]].join(" ")}>
                {STATUS_LABELS[entry.status] ? `${STATUS_LABELS[entry.status]} — ${entry.label}` : entry.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Working days */}
      {rules.workingDays.length > 0 && (
        <div className="pt-1">
          <p className="text-xs text-ink-900/40 mb-1.5">Working days</p>
          <div className="flex flex-wrap gap-1">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <span
                key={d}
                className={[
                  "rounded px-1.5 py-0.5 text-xs font-medium",
                  rules.workingDays.includes(d)
                    ? "bg-brand-50 text-brand-700"
                    : "bg-ink-900/4 text-ink-900/25",
                ].join(" ")}
              >
                {DAY_LABELS[d]}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-ink-900/35 italic">
        Each session is evaluated independently. Morning attendance does not affect afternoon.
      </p>
    </div>
  );
}
