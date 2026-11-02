import Link from "next/link";
import { Briefcase, ArrowRight, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { formatDate } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeader } from "./section-header";
import { EmploymentHistoryPanel } from "@/features/employment-history/employment-history-panel";

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

export async function EmploymentPanel({
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
  const t = await getTranslations("employees");
  const tC = await getTranslations("common");

  const statusTone =
    employmentStatus === "ACTIVE" ? "success" :
    employmentStatus === "ONBOARDING" ? "brand" :
    employmentStatus === "ON_LEAVE" ? "warning" :
    employmentStatus === "TERMINATED" || employmentStatus === "SUSPENDED" ? "danger" : "neutral";

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <SectionHeader icon={Briefcase} title={t("form.employmentDetails")} />
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-900/40">{t("overview.department")}</p>
            <p className="mt-1 text-sm font-medium text-ink-900">{department?.name ?? tC("na")}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-900/40">{t("overview.position")}</p>
            <p className="mt-1 text-sm font-medium text-ink-900">{position?.name ?? tC("na")}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-900/40">{t("overview.manager")}</p>
            {manager ? (
              <Link href={`/employees/${manager.id}`} className="mt-1 block text-sm font-medium text-brand-700 hover:underline">
                {manager.firstName} {manager.lastName}
              </Link>
            ) : (
              <p className="mt-1 text-sm text-ink-900/40">{tC("na")}</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-900/40">{t("overview.employmentType")}</p>
            <p className="mt-1 text-sm font-medium text-ink-900">
              {employmentType ? t(`types.${employmentType as "PERMANENT"|"CONTRACT"|"TEMPORARY"|"PROBATION"|"INTERNSHIP"}`) : tC("na")}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-900/40">{t("overview.hireDate")}</p>
            <p className="mt-1 text-sm font-medium text-ink-900">{formatDate(hireDate)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-900/40">{t("overview.status")}</p>
            <div className="mt-1">
              <Badge tone={statusTone}>
                {t(`statuses.${employmentStatus as "ACTIVE"|"ON_LEAVE"|"ONBOARDING"|"RESIGNED"|"RETIRED"|"INACTIVE"|"SUSPENDED"|"TERMINATED"}`)}
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title={t("form.employmentDetails")} description={tC("notes")} />
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
