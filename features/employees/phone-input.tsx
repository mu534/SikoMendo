"use client";

/**
 * PhoneInput — plain text input for phone numbers.
 *
 * Accepts any Ethiopian mobile number or international number typed directly:
 *   09XXXXXXXX  |  07XXXXXXXX  |  +2519XXXXXXXX  |  +2517XXXXXXXX  |  +XXXXXXXXX
 *
 * On blur the value is validated with normalizeAnyPhone (lib/phone-et). If
 * valid, the hidden <input name={name}> holds the normalized E.164 form; while
 * the user is still typing it holds the raw value so the form can still submit
 * after server-side normalization in the Zod schema.
 */

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { FieldError } from "@/components/ui/field";
import { normalizeAnyPhone } from "@/features/employees/schemas";

export function PhoneInput({
  name,
  defaultValue,
  required = true,
}: {
  name: string;
  defaultValue?: string | null;
  required?: boolean;
}) {
  // Display value shown in the text box — use the stored normalized number as
  // the initial value so edit forms pre-populate correctly.
  const [display, setDisplay] = useState<string>(defaultValue?.trim() ?? "");
  // Normalized value submitted with the form; starts equal to display.
  const [normalized, setNormalized] = useState<string>(defaultValue?.trim() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const tV = useTranslations("validation");
  const tE = useTranslations("employees");

  // Keep normalized in sync when defaultValue changes (e.g. edit form rehydration).
  const prevDefault = useRef(defaultValue);
  useEffect(() => {
    if (defaultValue !== prevDefault.current) {
      prevDefault.current = defaultValue;
      const v = defaultValue?.trim() ?? "";
      setDisplay(v);
      setNormalized(v);
    }
  }, [defaultValue]);

  function validate(raw: string): string | null {
    if (!raw.trim()) return required ? tV("required") : null;
    const norm = normalizeAnyPhone(raw.trim());
    if (!norm) return tV("invalidPhone");
    return null;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    setDisplay(raw);
    // Keep hidden input up-to-date so the Zod schema (which also normalizes)
    // always sees the latest raw value on submit.
    setNormalized(raw);
    if (touched) setError(validate(raw));
  }

  function handleBlur() {
    setTouched(true);
    const raw = display.trim();
    const err = validate(raw);
    setError(err);
    if (!err && raw) {
      // Store the canonical E.164 form in the hidden input on blur.
      const norm = normalizeAnyPhone(raw);
      if (norm) setNormalized(norm);
    }
  }

  return (
    <div>
      {/* Hidden input carries the value for form submission */}
      <input type="hidden" name={name} value={normalized} />

      <input
        type="tel"
        value={display}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={tE("form.phonePlaceholder")}
        autoComplete="tel"
        className="w-full rounded-lg border border-ink-900/15 bg-white px-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-900/40 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        aria-label={tE("form.phone")}
        aria-describedby={`${name}-hint`}
        aria-invalid={!!error}
      />

      <p id={`${name}-hint`} className="mt-1 text-xs text-ink-900/40">
        {tE("form.phoneHint")}
      </p>

      {touched && error && (
        <FieldError>{error}</FieldError>
      )}
    </div>
  );
}
