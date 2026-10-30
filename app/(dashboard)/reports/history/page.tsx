import {
  FileBarChart,
  FileText,
  Users,
  Building2,
  CalendarCheck,
  CalendarOff,
  ShieldCheck,
  Download,
  Trash2,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/permissions";
import { listReports } from "@/features/reports/queries";
import { deleteReport } from "@/features/reports/actions";
import { parsePageParam } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import type { Report } from "@prisma/client";

type ReportRow = Report & { generatedBy: { name: string } };

const REPORT_TYPE_ICONS: Record<string, typeof FileText> = {
  EMPLOYEE_DIRECTORY: Users,
  ATTENDANCE_SUMMARY: CalendarCheck,
  COOPERATIVE_LISTING: Building2,
  HEADCOUNT: Users,
  AUDIT_LOG: ShieldCheck,
  LEAVE_SUMMARY: CalendarOff,
};

export default async function ReportHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("VIEW_REPORTS");
  const { role, id: userId } = session.user;

  const t = await getTranslations("reports");

  // Only ADMIN has DELETE_REPORTS
  const canDelete = can(role, "DELETE_REPORTS");

  const params = await searchParams;
  const page = parsePageParam(params.page);

  // listReports is scoped by role:
  // ADMIN / HR_OFFICER → all reports
  // MANAGER / others   → only their own generated reports
  const { items, total, totalPages } = await listReports(page, userId, role);

  // Build localized type label map inside the component
  const typeLabels: Record<string, string> = {
    EMPLOYEE_DIRECTORY: t("types.EMPLOYEE_DIRECTORY"),
    ATTENDANCE_SUMMARY: t("types.ATTENDANCE_SUMMARY"),
    COOPERATIVE_LISTING: t("types.COOPERATIVE_LISTING"),
    HEADCOUNT: t("types.HEADCOUNT"),
    AUDIT_LOG: t("types.AUDIT_LOG"),
    LEAVE_SUMMARY: t("types.LEAVE_SUMMARY"),
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">{t("history.title")}</h2>
        <p className="mt-1 text-sm text-ink-900/60">
          {t("history.description")}
          {role === "MANAGER" && " " + t("history.managerNote")}
        </p>
      </div>

      <Card>
        <CardHeader
          title={t("history.reportCount", { count: total })}
          description={total === 0 ? t("noReports") : undefined}
        />

        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TH>{t("history.columns.report")}</TH>
              <TH>{t("headers.format")}</TH>
              <TH>{t("headers.generatedBy")}</TH>
              <TH>{t("headers.generatedAt")}</TH>
              <TH className="text-right">{t("columns.actions")}</TH>
            </THead>
            <TBody>
              {items.length === 0 && (
                <EmptyRow colSpan={5}>
                  <FileBarChart className="mx-auto mb-2 h-8 w-8 text-ink-900/20" />
                  <p>{t("noReports")}</p>
                </EmptyRow>
              )}

              {items.map((report: ReportRow) => {
                const Icon = REPORT_TYPE_ICONS[report.type] ?? FileText;

                const downloadUrl = report.fileKey
                  ? `/api/reports/${report.id}`
                  : null;

                return (
                  <TR key={report.id}>
                    <TD>
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink-900">{report.title}</p>
                          <p className="text-xs text-ink-900/50">
                            {typeLabels[report.type] ?? report.type}
                          </p>
                        </div>
                      </div>
                    </TD>

                    <TD>
                      <Badge tone={report.format === "PDF" ? "brand" : "neutral"}>
                        {report.format}
                      </Badge>
                    </TD>

                    <TD className="text-sm text-ink-900/70">{report.generatedBy.name}</TD>

                    <TD className="whitespace-nowrap text-sm text-ink-900/60">
                      {new Date(report.createdAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}{" "}
                      <span className="text-ink-900/40">
                        {new Date(report.createdAt).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </TD>

                    <TD className="text-right">
                      <div className="flex items-center justify-end gap-3">
                        {downloadUrl ? (
                          <a
                            href={downloadUrl}
                            download
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 transition hover:text-brand-800 hover:underline"
                          >
                            <Download className="h-3.5 w-3.5" />
                            {t("history.download")}
                          </a>
                        ) : (
                          <span className="text-xs text-ink-900/30">—</span>
                        )}

                        {canDelete && (
                          <form
                            action={async () => {
                              "use server";
                              await deleteReport(report.id);
                            }}
                          >
                            <ConfirmSubmitButton
                              confirmTitle={t("history.confirmDeleteTitle")}
                              confirmMessage={t("history.confirmDeleteMessage", { title: report.title })}
                              confirmLabel={t("history.confirmDeleteLabel")}
                              variant="ghost"
                              size="sm"
                              pendingLabel={t("history.deleting")}
                              className="text-ink-900/40 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="sr-only">{t("history.delete")}</span>
                            </ConfirmSubmitButton>
                          </form>
                        )}
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </div>

        <Pagination
          basePath="/reports/history"
          params={{}}
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={10}
        />
      </Card>
    </div>
  );
}
