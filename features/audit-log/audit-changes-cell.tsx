"use client";

/**
 * Renders the "Details" column cell for a single audit-log entry.
 *
 * On the surface: a compact one-line human-readable summary.
 * On expand:     a structured panel with labelled fields, plus the raw
 *                JSON as a secondary technical section for debugging.
 *
 * No server-side code is changed — this only transforms the stored JSON
 * at render time.
 */

import { ChevronDown } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Changes = Record<string, unknown> | null | undefined;

interface Props {
  action: string;
  entity: string;
  changes: Changes;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function str(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v || "—";
  return JSON.stringify(v);
}

function fmtDate(v: unknown): string {
  if (!v || typeof v !== "string") return str(v);
  // yyyy-mm-dd or ISO strings
  const d = new Date(v);
  if (isNaN(d.getTime())) return str(v);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function humanKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .replace(/Id$/, "")
    .trim();
}

// ── Per-(entity+action) summary line ─────────────────────────────────────────

function summaryLine(action: string, entity: string, c: Changes): string {
  if (!c) {
    // Actions with empty changes object
    const noData: Record<string, string> = {
      ARCHIVE: `${entity} archived`,
      RESTORE: `${entity} restored`,
      TERMINATE: "Contract terminated",
      PASSWORD_RESET: "Password reset by admin",
      FORCE_PASSWORD_CHANGE: "Forced password change on next sign-in",
    };
    return noData[action] ?? action.replace(/_/g, " ").toLowerCase();
  }

  // Employee
  if (entity === "Employee" && action === "CREATE") {
    const name = str(c.name);
    const id   = str(c.employeeId);
    return `Created ${id}${name !== "—" ? ` – ${name}` : ""}`;
  }
  if (entity === "Employee" && action === "UPDATE") {
    return c.updatedBy ? `Updated by ${str(c.updatedBy)}` : "Employee record updated";
  }

  // User
  if (entity === "User" && action === "CREATE") {
    const username = c.username ? `@${str(c.username)}` : "";
    const role     = str(c.role);
    const linked   = c.linkedEmployeeId ? ` · ${str(c.linkedEmployeeId)}` : "";
    return `Created ${username}${role !== "—" ? ` (${role})` : ""}${linked}`;
  }
  if (entity === "User" && action === "UPDATE") {
    const parts: string[] = [];
    if (c.name)     parts.push(`Name: ${str(c.name)}`);
    if (c.username) parts.push(`Username: @${str(c.username)}`);
    if (c.role)     parts.push(`Role: ${str(c.role)}`);
    if (c.photoChanged) parts.push("Photo updated");
    return parts.length ? parts.join(" · ") : "Account updated";
  }
  if (entity === "User" && action === "SUSPEND")     return "Account suspended";
  if (entity === "User" && action === "REACTIVATE")  return "Account reactivated";
  if (entity === "User" && action === "UPDATE_PROFILE") {
    const parts: string[] = [];
    if (c.name)         parts.push(`Name: ${str(c.name)}`);
    if (c.photoChanged) parts.push("Photo updated");
    return parts.length ? parts.join(" · ") : "Profile updated";
  }
  if (action === "PASSWORD_CHANGED") return "Password changed";
  if (action === "UPDATE_OWN_INFO") {
    const keys = Object.keys(c).filter((k) => k !== "photoChanged" && c[k] !== null);
    return keys.length ? `Updated: ${keys.map(humanKey).join(", ")}` : "Contact info updated";
  }

  // Leave Request
  if (entity === "LeaveRequest" && action === "CREATE") {
    const id   = str(c.leaveId);
    const type = str(c.leaveType).replace(/_/g, " ");
    const days = c.totalDays !== undefined ? ` · ${str(c.totalDays)} day${Number(c.totalDays) === 1 ? "" : "s"}` : "";
    return `${id} – ${type}${days}`;
  }
  if (entity === "LeaveRequest" && action === "CANCEL") {
    return `Status: ${str(c.from)} → ${str(c.to)}`;
  }
  if (entity === "LeaveRequest" && (action === "APPROVE" || action === "REJECT")) {
    const reason = c.rejectionReason ? `: ${str(c.rejectionReason)}` : "";
    return `${action === "APPROVE" ? "Approved" : "Rejected"}${reason}`;
  }

  // Leave Policy
  if (entity === "LeaveEntitlement" && action === "UPDATE") {
    if (Array.isArray(c.updates)) {
      const parts = (c.updates as Array<{ leaveType: string; daysPerYear: number | null }>)
        .map((u) =>
          `${str(u.leaveType).replace(/_/g, " ")}: ${u.daysPerYear ?? "unlimited"} day${u.daysPerYear === 1 ? "" : "s"}`
        );
      return `Policy updated — ${parts.join(", ")}`;
    }
    return "Leave policy updated";
  }

  // Employment History
  if (entity === "EmploymentHistory" && action === "CREATE") {
    const date   = c.effectiveDate ? fmtDate(c.effectiveDate) : null;
    const reason = str(c.changeReason);
    return date ? `Effective ${date} – ${reason}` : reason;
  }

  // Contract
  if (entity === "Contract" && action === "CREATE") {
    const type  = str(c.contractType).replace(/_/g, " ");
    const start = c.startDate ? fmtDate(c.startDate) : null;
    return `${type}${start ? ` from ${start}` : ""}`;
  }

  // Attendance
  if (entity === "Attendance" && action === "UPSERT") {
    const date   = c.date ? fmtDate(c.date) : "—";
    const status = str(c.status).replace(/_/g, " ");
    return `${date} – ${status}`;
  }
  if (entity === "Attendance" && action === "BULK_MARK_PRESENT") {
    const count = c.count ?? "?";
    return `Marked ${count} employee${count === 1 ? "" : "s"} present`;
  }

  // Cooperative
  if (entity === "Cooperative" && action === "CREATE") {
    const id   = str(c.cooperativeId);
    const name = str(c.name);
    return `Created ${id}${name !== "—" ? ` – ${name}` : ""}`;
  }

  // Department
  if (entity === "Department" && (action === "ACTIVATE" || action === "DEACTIVATE")) {
    return action === "ACTIVATE" ? "Department activated" : "Department deactivated";
  }

  // Position
  if (entity === "Position" && action === "CREATE") {
    const name = str(c.name);
    const dept = c.department ? ` in ${str(c.department)}` : "";
    return `${name}${dept}`;
  }
  if (entity === "Position" && (action === "ACTIVATE" || action === "DEACTIVATE")) {
    return action === "ACTIVATE" ? "Position activated" : "Position deactivated";
  }

  // Report
  if (entity === "Report" && action === "CREATE") {
    const title  = str(c.title);
    const format = str(c.format);
    return `${title}${format !== "—" ? ` (${format})` : ""}`;
  }
  if (entity === "Report" && action === "DELETE") {
    return `Deleted: ${str(c.title)}`;
  }

  // Fallback for UPDATE-style actions: list changed keys concisely
  if (action === "UPDATE") {
    const skipKeys = new Set(["id", "updatedAt", "createdAt", "updatedBy"]);
    const keys = Object.keys(c).filter((k) => !skipKeys.has(k));
    return keys.length ? `Updated: ${keys.map(humanKey).join(", ")}` : `${entity} updated`;
  }

  // Generic fallback
  const keys = Object.keys(c);
  if (keys.length === 0) return action.replace(/_/g, " ").toLowerCase();
  if (keys.length <= 2) {
    return keys
      .map((k) => `${humanKey(k)}: ${str(c[k])}`)
      .join(" · ");
  }
  return `${keys.length} fields changed`;
}

// ── Structured detail rows ────────────────────────────────────────────────────

interface DetailRow {
  label: string;
  value: string;
}

function detailRows(action: string, entity: string, c: Changes): DetailRow[] {
  if (!c || Object.keys(c).length === 0) return [];

  const skipKeys = new Set(["__typename"]);
  const rows: DetailRow[] = [];

  // Special formatting for known shapes
  if (entity === "LeaveEntitlement" && action === "UPDATE" && Array.isArray(c.updates)) {
    (c.updates as Array<{ leaveType: string; daysPerYear: number | null }>).forEach((u) => {
      rows.push({
        label: str(u.leaveType).replace(/_/g, " "),
        value: u.daysPerYear !== null && u.daysPerYear !== undefined
          ? `${u.daysPerYear} day${u.daysPerYear === 1 ? "" : "s"} / year`
          : "Unlimited",
      });
    });
    return rows;
  }

  if (entity === "EmploymentHistory" && action === "CREATE") {
    if (c.effectiveDate) rows.push({ label: "Effective date", value: fmtDate(c.effectiveDate) });
    if (c.changeReason)  rows.push({ label: "Reason", value: str(c.changeReason) });
    if (c.employmentType) rows.push({ label: "Employment type", value: str(c.employmentType).replace(/_/g, " ") });
    // Skip IDs — they're shown in the Module/Record column
    return rows;
  }

  if (entity === "LeaveRequest" && action === "CREATE") {
    if (c.leaveId)    rows.push({ label: "Leave ID", value: str(c.leaveId) });
    if (c.leaveType)  rows.push({ label: "Type", value: str(c.leaveType).replace(/_/g, " ") });
    if (c.totalDays !== undefined) rows.push({ label: "Days", value: str(c.totalDays) });
    return rows;
  }

  if (entity === "LeaveRequest" && action === "CANCEL") {
    rows.push({ label: "Status", value: `${str(c.from)} → ${str(c.to)}` });
    return rows;
  }

  if ((action === "APPROVE" || action === "REJECT") && entity === "LeaveRequest") {
    rows.push({ label: "Decision", value: str(c.decision) });
    if (c.rejectionReason) rows.push({ label: "Reason", value: str(c.rejectionReason) });
    return rows;
  }

  if (entity === "Attendance" && action === "UPSERT") {
    if (c.date)   rows.push({ label: "Date", value: fmtDate(c.date) });
    if (c.status) rows.push({ label: "Status", value: str(c.status).replace(/_/g, " ") });
    return rows;
  }

  if (entity === "Attendance" && action === "BULK_MARK_PRESENT") {
    rows.push({ label: "Employees marked", value: str(c.count) });
    return rows;
  }

  // Generic: iterate keys, format values nicely
  const dateKeys = new Set(["date", "startDate", "endDate", "effectiveDate", "hireDate", "createdAt"]);
  for (const key of Object.keys(c)) {
    if (skipKeys.has(key)) continue;
    const val = c[key];
    const label = humanKey(key);

    if (key === "photoChanged") {
      if (val) rows.push({ label: "Profile photo", value: "Updated" });
      continue;
    }
    if (key === "selfService") {
      rows.push({ label: "Changed via", value: "Self-service profile" });
      continue;
    }
    if (key === "firstLogin") {
      rows.push({ label: "Changed via", value: "First-login flow" });
      continue;
    }
    if (key === "updates" && Array.isArray(val)) continue; // handled above

    const display = dateKeys.has(key) ? fmtDate(val) : str(val);
    rows.push({ label, value: display });
  }
  return rows;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AuditChangesCell({ action, entity, changes }: Props) {
  const summary = summaryLine(action, entity, changes);
  const rows    = detailRows(action, entity, changes);

  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-start gap-1.5 text-sm text-ink-900/70 hover:text-ink-900">
        <span className="flex-1 truncate max-w-[200px]">{summary}</span>
        {(rows.length > 0 || changes) && (
          <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-900/35 transition-transform group-open:rotate-180" />
        )}
      </summary>

      {(rows.length > 0 || changes) && (
        <div className="mt-2 space-y-2 rounded-lg border border-ink-900/8 bg-sand-50 p-3 text-xs">
          {/* Human-readable rows */}
          {rows.length > 0 && (
            <dl className="space-y-1.5">
              {rows.map((r) => (
                <div key={r.label} className="flex items-baseline gap-2">
                  <dt className="w-32 shrink-0 font-medium text-ink-900/55">{r.label}</dt>
                  <dd className="text-ink-900/80 break-all">{r.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {/* Raw JSON for debugging — secondary, collapsed by default */}
          {changes && (
            <details className="group/raw">
              <summary className="cursor-pointer text-[10px] font-medium uppercase tracking-wide text-ink-900/35 hover:text-ink-900/60">
                Raw JSON
              </summary>
              <pre className="mt-1.5 overflow-x-auto rounded bg-white p-2 text-[10px] text-ink-900/55 whitespace-pre-wrap break-all">
                {JSON.stringify(changes, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </details>
  );
}
