"use client";

/**
 * PhoneInput — Ethiopian mobile phone input with operator + prefix dropdowns.
 *
 * Renders three controls side-by-side:
 *   [Operator ▾]  [Prefix ▾]  [Subscriber digits _______]
 *
 * A single hidden <input name={name}> carries the assembled normalized number
 * so the rest of the form and server schema receive a standard string.
 *
 * For Other / International, the prefix dropdown is hidden and a single
 * free-text input accepts any E.164-formatted number (e.g. +44 7911 123456).
 */

import { useState, useEffect } from "react";
import { Select, FieldError } from "@/components/ui/field";
import {
  OPERATORS,
  normalizeEthiopianPhone,
  normalizeInternationalPhone,
  isValidInternationalPhone,
  detectOperator,
  extractPrefix,
  extractSubscriberDigits,
  type OperatorId,
} from "@/lib/phone-et";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Filter digits only from a string. */
function digitsOnly(v: string): string {
  return v.replace(/\D/g, "");
}

// ── State initializer — parse a saved normalized number ───────────────────────

type PhoneState = {
  operatorId:  OperatorId;
  prefix:      string;   // "091" for Ethiopian, "" for Other
  subscriber:  string;   // "2345678" for Ethiopian, full number for Other
  intlNumber:  string;   // full input when operatorId === "OTHER"
};

function parseInitial(saved: string | null | undefined): PhoneState {
  if (!saved || saved.trim() === "") {
    return { operatorId: "ETHIO_TELECOM", prefix: "091", subscriber: "", intlNumber: "" };
  }
  const trimmed = saved.trim();
  // Try Ethiopian normalization first
  const normalized = normalizeEthiopianPhone(trimmed);
  if (normalized) {
    const op  = detectOperator(normalized);
    const pfx = extractPrefix(normalized);
    const sub = extractSubscriberDigits(normalized);
    if (op !== "OTHER" && pfx) {
      return { operatorId: op, prefix: pfx, subscriber: sub, intlNumber: "" };
    }
  }
  // Fall back to Other / International
  return { operatorId: "OTHER", prefix: "", subscriber: "", intlNumber: trimmed };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PhoneInput({
  name,
  defaultValue,
  required = true,
}: {
  name:           string;
  defaultValue?:  string | null;
  required?:      boolean;
}) {
  const [state,     setState]     = useState<PhoneState>(() => parseInitial(defaultValue));
  const [error,     setError]     = useState<string | null>(null);
  const [touched,   setTouched]   = useState(false);

  const operator = OPERATORS.find((o) => o.id === state.operatorId) ?? OPERATORS[0]!;
  const isOther  = state.operatorId === "OTHER";

  // ── Derived assembled value ────────────────────────────────────────────────
  const assembledValue: string = (() => {
    if (isOther) {
      return state.intlNumber.trim();
    }
    if (!state.prefix || !state.subscriber.trim()) return "";
    // Build local form e.g. 0912345678, then normalize to +251XXXXXXXXX
    const local = `${state.prefix}${state.subscriber.trim()}`;
    return normalizeEthiopianPhone(local) ?? "";
  })();

  // ── Validation ─────────────────────────────────────────────────────────────
  function validate(s: PhoneState): string | null {
    const op = s.operatorId;
    if (op === "OTHER") {
      const raw = s.intlNumber.trim();
      if (!raw) return required ? "Phone number is required" : null;
      if (!isValidInternationalPhone(raw)) {
        return "Enter a valid international number starting with + and country code (e.g. +44 7911 123456)";
      }
      return null;
    }
    // Ethiopian
    if (!s.prefix) return "Select a prefix";
    if (!s.subscriber.trim()) return required ? "Enter the remaining digits" : null;

    const pfxEntry = operator.prefixes.find((p) => p.prefix === s.prefix);
    const expected = pfxEntry?.subscriberDigits ?? 7;
    const digits   = digitsOnly(s.subscriber);
    if (digits.length !== expected) {
      return `Enter ${expected} digits after the prefix (e.g. ${state.prefix} ${"X".repeat(expected)})`;
    }
    const normalized = normalizeEthiopianPhone(`${s.prefix}${digits}`);
    if (!normalized) return "Invalid phone number";
    return null;
  }

  // Re-validate when any part of state changes (after first touch)
  useEffect(() => {
    if (touched) setError(validate(state));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, touched]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleOperatorChange(opId: OperatorId) {
    const op       = OPERATORS.find((o) => o.id === opId)!;
    const newPrefix = op.prefixes[0]?.prefix ?? "";
    setState({ operatorId: opId, prefix: newPrefix, subscriber: "", intlNumber: "" });
    setTouched(true);
  }

  function handlePrefixChange(pfx: string) {
    setState((s) => ({ ...s, prefix: pfx, subscriber: "" }));
    setTouched(true);
  }

  function handleSubscriberChange(v: string) {
    const digits = digitsOnly(v);
    const pfxEntry = operator.prefixes.find((p) => p.prefix === state.prefix);
    const max = pfxEntry?.subscriberDigits ?? 7;
    setState((s) => ({ ...s, subscriber: digits.slice(0, max) }));
    setTouched(true);
  }

  function handleIntlChange(v: string) {
    setState((s) => ({ ...s, intlNumber: v }));
    setTouched(true);
  }

  function handleBlur() {
    setTouched(true);
    setError(validate(state));
  }

  const pfxEntry = operator.prefixes.find((p) => p.prefix === state.prefix);
  const maxDigits = pfxEntry?.subscriberDigits ?? 7;

  return (
    <div>
      {/* Hidden input carries the normalized number for form submission */}
      <input type="hidden" name={name} value={assembledValue} />

      {isOther ? (
        /* ── International / Other: single free-text input ── */
        <div>
          <div className="flex gap-2">
            {/* Operator selector */}
            <div className="w-44 shrink-0">
              <Select
                value={state.operatorId}
                onChange={(e) => handleOperatorChange(e.target.value as OperatorId)}
                onBlur={handleBlur}
                aria-label="Mobile operator"
              >
                {OPERATORS.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </Select>
            </div>

            {/* Full international number */}
            <div className="flex-1">
              <input
                type="tel"
                value={state.intlNumber}
                onChange={(e) => handleIntlChange(e.target.value)}
                onBlur={handleBlur}
                placeholder="+44 7911 123456"
                className="w-full rounded-lg border border-ink-900/15 bg-white px-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-900/40 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                aria-label="International phone number"
              />
            </div>
          </div>
          <p className="mt-1 text-xs text-ink-900/40">
            Include country code, e.g. +44 7911 123456
          </p>
        </div>
      ) : (
        /* ── Ethiopian mobile: operator + prefix + subscriber ── */
        <div>
          <div className="flex gap-2">
            {/* Operator selector */}
            <div className="w-44 shrink-0">
              <Select
                value={state.operatorId}
                onChange={(e) => handleOperatorChange(e.target.value as OperatorId)}
                onBlur={handleBlur}
                aria-label="Mobile operator"
              >
                {OPERATORS.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </Select>
            </div>

            {/* Prefix selector */}
            <div className="w-24 shrink-0">
              <Select
                value={state.prefix}
                onChange={(e) => handlePrefixChange(e.target.value)}
                onBlur={handleBlur}
                aria-label="Number prefix"
              >
                {operator.prefixes.map((p) => (
                  <option key={p.prefix} value={p.prefix}>{p.label}</option>
                ))}
              </Select>
            </div>

            {/* Subscriber digits */}
            <div className="flex-1">
              <input
                type="tel"
                inputMode="numeric"
                value={state.subscriber}
                onChange={(e) => handleSubscriberChange(e.target.value)}
                onBlur={handleBlur}
                placeholder={"X".repeat(maxDigits)}
                maxLength={maxDigits}
                className="w-full rounded-lg border border-ink-900/15 bg-white px-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-900/40 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                aria-label="Subscriber digits"
              />
            </div>
          </div>

          {/* Live preview of the assembled number */}
          {assembledValue && !error && (
            <p className="mt-1 text-xs text-ink-900/40">
              Saves as: <span className="font-mono">{assembledValue}</span>
            </p>
          )}
          <p className="mt-0.5 text-xs text-ink-900/35">
            Enter {maxDigits} digits after the prefix
          </p>
        </div>
      )}

      {/* Field-level validation error */}
      {touched && error && <FieldError>{error}</FieldError>}
    </div>
  );
}
