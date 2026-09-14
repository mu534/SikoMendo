"use client";

/**
 * Live preview panel that dynamically calculates and displays attendance
 * status examples based on the current unsaved form values.
 *
 * Pure client-side computation — no server calls, no stale data.
 * Works for any shift: uses the shift's startTime (if provided) or a default.
 */

import { useState, useEffect } from "react";
import type { ShiftRow } from "./shift-queries";
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
  status: "present" | "late" | "half_day" | "note";
};

function buildTimeline(
  shiftStart: string,
  gracePeriodMinutes: number,
  halfDayMinutes: number | null
): TimelineEntry[] {
  const startMins  = parseTimeToMinutes(shiftStart);
  const graceCutoff = startMins + gracePeriodMinutes;
  const halfCutoff  = halfDayMinutes != null ? graceCutoff + halfDayMinutes : null;

  const entries: TimelineEntry[] = [
    {
      time:   minutesToTime(startMins),
      label:  "Shift starts",
      status: "note",
    },
    {
      time:   minutesToTime(graceCutoff),
      label:  `Grace period ends (${gracePeriodMinutes} min)`,
      status: "present",
    },
    {
      time:   `After ${minutesToTime(graceCutoff)}`,
      label:  "Late",
      status: "late",
    },
  ];

  if (halfCutoff !== null && halfDayMinutes != null) {
    entries.push({
      time:   `After ${minutesToTime(halfCutoff)}`,
      label:  `Half Day (${halfDayMinutes} min after grace ends)`,
      status: "half_day",
    });
  }

  return entries;
}

const STATUS_STYLES: Record<string, string> = {
  present:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  late:     "bg-gold-400/10 text-gold-700 border-gold-400/30",
  half_day: "bg-gold-400/10 text-gold-700 border-gold-400/30",
  note:     "bg-ink-900/5 text-ink-900/60 border-ink-900/10",
};

const STATUS_LABELS: Record<string, string> = {
  present:  "Present",
  late:     "Late",
  half_day: "Half Day",
  note:     "",
};

type Props = {
  rules: RulesFormValues;
  /** Active shifts for the overview panel. */
  activeShifts: ShiftRow[];
};

export function PolicyPreview({ rules, activeShifts }: Props) {
  const [selectedShiftIdx, setSelectedShiftIdx] = useState(0);

  // Reset selection if shifts change
  useEffect(() => {
    setSelectedShiftIdx((i) => Math.min(i, Math.max(0, activeShifts.length - 1)));
  }, [activeShifts.length]);

  const previewShift = activeShifts[selectedShiftIdx];
  const shiftStart   = previewShift?.startTime ?? "08:00";

  const halfDayMins =
    typeof rules.halfDayThresholdMinutes === "number"
      ? rules.halfDayThresholdMinutes
      : rules.halfDayThresholdMinutes !== "" && rules.halfDayThresholdMinutes != null
        ? Number(rules.halfDayThresholdMinutes) || null
        : null;

  const timeline = buildTimeline(shiftStart, rules.gracePeriodMinutes, halfDayMins);

  return (
    <div className="space-y-3">
      {/* Shift selector for preview */}
      {activeShifts.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {activeShifts.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelectedShiftIdx(i)}
              className={[
                "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
                i === selectedShiftIdx
                  ? "bg-brand-700 text-white"
                  : "bg-ink-900/6 text-ink-900/60 hover:bg-ink-900/10 hover:text-ink-900",
              ].join(" ")}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {activeShifts.length === 0 && (
        <p className="text-xs text-ink-900/40 italic">
          Add and activate at least one shift to see the preview.
        </p>
      )}

      {/* Timeline */}
      {activeShifts.length > 0 && (
        <div className="space-y-1.5">
          {timeline.map((entry, i) => (
            <div key={i} className="flex items-baseline gap-3">
              <span className="w-28 shrink-0 text-right text-xs font-mono text-ink-900/55">
                {entry.time}
              </span>
              <span
                className={[
                  "rounded border px-2 py-0.5 text-xs font-medium",
                  STATUS_STYLES[entry.status],
                ].join(" ")}
              >
                {STATUS_LABELS[entry.status]
                  ? `${STATUS_LABELS[entry.status]} — ${entry.label}`
                  : entry.label}
              </span>
            </div>
          ))}
        </div>
      )}

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
    </div>
  );
}
