import Link from "next/link";
import { Briefcase, ArrowRight, Plus } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeader } from "./section-header";
import { EmploymentHistoryPanel } from "@/features/employment-history/employment-history-panel";

const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  PERMANENT:  "Permanent",
  CONTRACT:   "Contract",
  TEMPORARY:  "Temporary",
  PROBATION:  "Probation",
  INTERNSHIP: "Internship",
};

type HistoryRow = {
  id: string;
  department: { name: string };
  position: { name: string };
  employmentType: string | null;
  effectiveDate: Date;
  endDate: Date | null;
  changeReason: string;
  remarks: string | null;
};

type DepartmentOption = { id: string; name: string };
type PositionOption = { id: string; name: string; departmentId: string };

export function EmploymentPanel({
  employeeId,
  department,
  position,
  manager,
  employmentType,
  hireDate,
  employmentStatus,
  history,
  departments,
  positions,
  currentDepartmentId,
  canManage,
  linkedUser,
  canChangeRole,
}: {
  employeeId: string;
  department?: { name: string } | null;
  position?: { name: string } | null;
  manager?: { id: string; firstName: string; lastName: string; employeeId: string } | null;
  employmentType?: string | null;
  hireDate?: Date | null;
  employmentStatus: string;
  history: HistoryRow[];
  departments: DepartmentOption[];
  positions: PositionOption[];
  currentDepartmentId?: string;
  canManage: boolean;
  linkedUser?: { id: string; role: string } | null;
  canChangeRole?: boolean;
}) {
  const statusTone =
    employmentStatus === "ACTIVE" ? "success" :
    employmentStatus === "ONBOARDING" ? "brand" :
    employmentStatus === "ON_LEAVE" ? "warning" :
    employmentStatus === "TERMINATED" || employmentStatus === "SUSPENDED" ? "danger" : "neutral";

  return (
    <div className="space-y-6">
      {/* ── Current Employment ─────────────────────────────────────────── */}
      <Card className="p-5">
        <SectionHeader icon={Briefcase} title="Current Employment" />
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-900/40">Department</p>
            <p className="mt-1 text-sm font-medium text-ink-900">{department?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-900/40">Position</p>
            <p className="mt-1 text-sm font-medium text-ink-900">{position?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-900/40">Manager</p>
            {manager ? (
              <Link
                href={`/employees/${manager.id}`}
                className="mt-1 block text-sm font-medium text-brand-700 hover:underline"
              >
                {manager.firstName} {manager.lastName}
              </Link>
            ) : (
              <p className="mt-1 text-sm text-ink-900/40">—</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-900/40">Employment Type</p>
            <p className="mt-1 text-sm font-medium text-ink-900">
              {EMPLOYMENT_TYPE_LABEL[employmentType ?? ""] ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-900/40">Hire Date</p>
            <p className="mt-1 text-sm font-medium text-ink-900">{formatDate(hireDate)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-900/40">Status</p>
            <div className="mt-1">
              <Badge tone={statusTone}>
                {employmentStatus.replace(/_/g, " ")}
              </Badge>
            </div>
          </div>
        </div>

        {canManage && (
          <p className="mt-5 text-xs text-ink-900/45 border-t border-ink-900/6 pt-4">
            To change department, position, or employment type, use{" "}
            <span className="font-medium text-ink-900/70">Record Employment Change</span>{" "}
            below — this preserves the complete employment history.
          </p>
        )}
      </Card>

      {/* ── Employment History ─────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Employment History"
          description="Append-only record of department, position, and employment-type changes."
        />
        <div className="px-5 pb-5">
          <EmploymentHistoryPanel
            employeeId={employeeId}
            history={history}
            departments={departments}
            positions={positions}
            currentDepartmentId={currentDepartmentId ?? ""}
            canManage={canManage}
            linkedUser={linkedUser ?? null}
            canChangeRole={canChangeRole}
          />
        </div>
      </Card>
    </div>
  );
}
