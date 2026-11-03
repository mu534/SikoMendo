"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, ShieldAlert, Copy } from "lucide-react";
import { createManagerAccount } from "./actions";
import { Label, FieldGroup, Select } from "@/components/ui/field";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { getEmployeesWithoutAccount, getActiveDepartments } from "./queries";

// ── Types ─────────────────────────────────────────────────────────────────────

type Employee = Awaited<ReturnType<typeof getEmployeesWithoutAccount>>[number];
type Department = Awaited<ReturnType<typeof getActiveDepartments>>[number];

type Props = {
  employees: Awaited<ReturnType<typeof getEmployeesWithoutAccount>>;
  departments: Awaited<ReturnType<typeof getActiveDepartments>>;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function CreateManagerAccountForm({ employees, departments }: Props) {
  const t = useTranslations("users");
  const tC = useTranslations("common");

  const [state, formAction, isPending] = useActionState(createManagerAccount, null);

  // Employee picker state
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  // Role state
  const [role, setRole] = useState<"MANAGER" | "DEPT_MANAGER">("MANAGER");
  const [departmentId, setDepartmentId] = useState("");

  // Copy state
  const [copied, setCopied] = useState<"username" | "password" | null>(null);

  // Filtered employee list
  const filtered =
    query.trim() === ""
      ? employees.slice(0, 12)
      : employees
          .filter((e) => {
            const full = `${e.firstName} ${e.lastName} ${e.employeeId}`.toLowerCase();
            return full.includes(query.toLowerCase());
          })
          .slice(0, 12);

  async function copyToClipboard(value: string, field: "username" | "password") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(field);
      setTimeout(() => setCopied((c) => (c === field ? null : c)), 1800);
    } catch {
      // clipboard not available — value is visible in UI
    }
  }

  function handleRoleChange(next: "MANAGER" | "DEPT_MANAGER") {
    setRole(next);
    if (next === "MANAGER") setDepartmentId("");
  }

  // ── Post-submission credential reveal ──────────────────────────────────────
  if (state?.success === true) {
    const { username, password } = state.data;
    return (
      <Card className="max-w-3xl p-6">
        <div className="space-y-4">
          {/* Warning banner */}
          <div className="flex items-start gap-2 rounded-xl border border-gold-400/30 bg-gold-400/10 px-4 py-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" aria-hidden="true" />
            <p className="text-xs text-ink-900/70">{t("form.credentialsBanner")}</p>
          </div>

          {/* Credentials box */}
          <div className="space-y-3 rounded-xl border border-ink-900/8 bg-sand-50 p-4">
            {/* Username */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-900/45">
                {t("form.username")}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <p className="font-mono text-sm font-medium text-ink-900">{username}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(username, "username")}
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied === "username" ? tC("confirm") : tC("save")}
                </Button>
              </div>
            </div>
            {/* Password */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-900/45">
                {t("form.password")}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <p className="font-mono text-sm font-medium text-ink-900">{password}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(password, "password")}
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied === "password" ? tC("confirm") : tC("save")}
                </Button>
              </div>
            </div>
          </div>

          {/* Done button */}
          <ButtonLink href="/users" variant="secondary">
            {t("form.credentialsDone")}
          </ButtonLink>
        </div>
      </Card>
    );
  }

  const error = state?.success === false ? state.error.message : null;

  return (
    <Card className="max-w-3xl p-6">
      <form action={formAction} className="space-y-6">
        {/* ── Section: Select Employee ─────────────────────────────────── */}
        <div className="space-y-4">
          <h3 className="font-display text-base font-semibold text-ink-900">
            {t("form.selectEmployee")}
          </h3>

          {/* Hidden employeeId submitted with form */}
          <input
            type="hidden"
            name="employeeId"
            value={selectedEmployee?.id ?? ""}
          />

          {employees.length === 0 ? (
            <p className="rounded-lg border border-ink-900/8 bg-sand-50 px-4 py-3 text-sm text-ink-900/60">
              {t("form.noEmployeesAvailable")}
            </p>
          ) : (
            <div className="space-y-2">
              {/* Search input */}
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-900/35"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  role="combobox"
                  aria-expanded={open}
                  aria-haspopup="listbox"
                  aria-label={t("form.selectEmployee")}
                  placeholder={
                    selectedEmployee
                      ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}`
                      : t("form.selectEmployee")
                  }
                  value={query}
                  onFocus={() => setOpen(true)}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setOpen(true);
                  }}
                  onBlur={() => setTimeout(() => setOpen(false), 150)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setOpen(false);
                      setQuery("");
                    }
                  }}
                  className="w-full rounded-lg border border-ink-900/15 bg-white py-2 pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-900/35 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
                />
              </div>

              {/* Selected employee chip */}
              {selectedEmployee && !open && (
                <div className="flex items-center justify-between rounded-lg border border-ink-900/8 bg-sand-50 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-ink-900">
                      {selectedEmployee.firstName} {selectedEmployee.lastName}
                    </p>
                    <p className="text-xs text-ink-900/45">
                      {selectedEmployee.employeeId}
                      {selectedEmployee.department?.name
                        ? ` · ${selectedEmployee.department.name}`
                        : ""}
                      {selectedEmployee.position?.name
                        ? ` · ${selectedEmployee.position.name}`
                        : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEmployee(null);
                      setQuery("");
                    }}
                    className="text-xs font-medium text-ink-900/40 hover:text-ink-900"
                    aria-label={tC("clear")}
                  >
                    {tC("clear")}
                  </button>
                </div>
              )}

              {/* Dropdown listbox */}
              {open && (
                <ul
                  role="listbox"
                  aria-label={t("form.selectEmployee")}
                  className="relative z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-ink-900/10 bg-white py-1 shadow-lg shadow-ink-900/8"
                >
                  {filtered.length === 0 && (
                    <li className="px-3 py-2 text-sm text-ink-900/40">
                      {tC("noResults")}
                    </li>
                  )}
                  {filtered.map((e) => (
                    <li
                      key={e.id}
                      role="option"
                      aria-selected={selectedEmployee?.id === e.id}
                      onMouseDown={() => {
                        setSelectedEmployee(e);
                        setQuery("");
                        setOpen(false);
                      }}
                      className={`cursor-pointer px-3 py-2.5 hover:bg-sand-50 ${
                        selectedEmployee?.id === e.id ? "bg-brand-50" : ""
                      }`}
                    >
                      <p className="text-sm font-medium text-ink-900">
                        {e.firstName} {e.lastName}
                      </p>
                      <p className="text-xs text-ink-900/45">
                        [{e.employeeId}]{" "}
                        {e.department?.name ? `${e.department.name}` : ""}
                        {e.position?.name ? ` · ${e.position.name}` : ""}
                      </p>
                    </li>
                  ))}
                  {employees.length > 12 && filtered.length === 12 && (
                    <li className="px-3 py-1.5 text-xs text-ink-900/35">
                      {tC("search")}
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* ── Section: Account Settings ────────────────────────────────── */}
        <div className="space-y-4 border-t border-ink-900/8 pt-5">
          <h3 className="font-display text-base font-semibold text-ink-900">
            {t("form.accountSettings")}
          </h3>

          {/* Read-only username display */}
          <FieldGroup>
            <Label>{t("form.username")}</Label>
            <div className="w-full rounded-lg border border-ink-900/15 bg-sand-100 px-3.5 py-2.5 text-sm text-ink-900/60 cursor-default font-mono">
              {selectedEmployee?.employeeId.toLowerCase() ?? ""}
            </div>
            <p className="text-xs text-ink-900/50">{t("form.derivedUsername")}</p>
          </FieldGroup>

          {/* Role radio cards */}
          <FieldGroup>
            <Label>{t("form.role")}</Label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* MANAGER card */}
              <label
                className={`relative flex cursor-pointer flex-col gap-1 rounded-xl border p-4 transition-colors ${
                  role === "MANAGER"
                    ? "border-brand-500 bg-brand-50"
                    : "border-ink-900/15 bg-white hover:bg-sand-50"
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value="MANAGER"
                  checked={role === "MANAGER"}
                  onChange={() => handleRoleChange("MANAGER")}
                  className="sr-only"
                />
                <span className="font-medium text-sm text-ink-900">
                  {tC("roles.MANAGER")}
                </span>
                <span className="text-xs text-ink-900/55">
                  {t("form.roleManagerDesc")}
                </span>
              </label>

              {/* DEPT_MANAGER card */}
              <label
                className={`relative flex cursor-pointer flex-col gap-1 rounded-xl border p-4 transition-colors ${
                  role === "DEPT_MANAGER"
                    ? "border-brand-500 bg-brand-50"
                    : "border-ink-900/15 bg-white hover:bg-sand-50"
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value="DEPT_MANAGER"
                  checked={role === "DEPT_MANAGER"}
                  onChange={() => handleRoleChange("DEPT_MANAGER")}
                  className="sr-only"
                />
                <span className="font-medium text-sm text-ink-900">
                  {tC("roles.DEPT_MANAGER")}
                </span>
                <span className="text-xs text-ink-900/55">
                  {t("form.roleDeptManagerDesc")}
                </span>
              </label>
            </div>
          </FieldGroup>

          {/* Department select — shown only for DEPT_MANAGER */}
          {role === "DEPT_MANAGER" && (
            <FieldGroup>
              <Label htmlFor="departmentId">{t("form.selectDepartment")}</Label>
              <Select
                id="departmentId"
                name="departmentId"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                required={role === "DEPT_MANAGER"}
              >
                <option value="">{t("form.selectDepartment")}</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </FieldGroup>
          )}
        </div>

        {/* ── Error banner ─────────────────────────────────────────────── */}
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            {error}
          </div>
        )}

        {/* ── Action buttons ────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 pt-1">
          <Button
            type="submit"
            disabled={isPending || !selectedEmployee}
          >
            {isPending ? t("form.creating") : t("form.createAccount")}
          </Button>
          <ButtonLink href="/users" variant="ghost">
            {tC("cancel")}
          </ButtonLink>
        </div>
      </form>
    </Card>
  );
}
