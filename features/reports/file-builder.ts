import "server-only";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import prisma from "@/lib/prisma";
import { LEAVE_TYPE_LABELS, LEAVE_STATUS_LABELS, type LeaveStatusValue, type LeaveTypeValue } from "@/features/leave/schemas";
import type { ReportType, ReportFormat, Prisma } from "@prisma/client";

export type LeaveReportFilters = {
  employeeId?: string;
  leaveType?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
};

type ReportContent = {
  /** Heading printed inside the file itself (can be more specific than the DB title, e.g. include the month). */
  docTitle: string;
  headers: string[];
  rows: (string | number)[][];
  /** Small facts persisted on the Report row for the history list. */
  parameters: Record<string, unknown>;
};

// ── Per-type data gathering ─────────────────────────────────────────────────

async function buildEmployeeDirectoryContent(): Promise<ReportContent> {
  const employees = await prisma.employee.findMany({
    where: { deletedAt: null },
    include: { cooperative: { select: { name: true } } },
    orderBy: [{ department: "asc" }, { firstName: "asc" }],
  });

  return {
    docTitle: "Employee Directory",
    headers: ["Employee ID", "Name", "Department", "Position", "Cooperative", "Status", "Phone", "Email"],
    rows: employees.map((e) => [
      e.employeeId,
      `${e.firstName}${e.middleName ? ` ${e.middleName}` : ""} ${e.lastName}`,
      e.department ?? "—",
      e.position ?? "—",
      e.cooperative?.name ?? "—",
      e.employmentStatus.replace("_", " "),
      e.phone ?? "—",
      e.email ?? "—",
    ]),
    parameters: { totalEmployees: employees.length },
  };
}

async function buildAttendanceSummaryContent(): Promise<ReportContent> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const counts = await prisma.attendance.groupBy({
    by: ["status"],
    _count: true,
    where: { date: { gte: startOfMonth } },
  });

  const month = startOfMonth.toISOString().slice(0, 7);
  const total = counts.reduce((sum, c) => sum + c._count, 0);

  return {
    docTitle: `Attendance Summary — ${month}`,
    headers: ["Status", "Count"],
    rows: counts.map((c) => [c.status.replace("_", " "), c._count]),
    parameters: { month, breakdown: counts, total },
  };
}

async function buildCooperativeListingContent(): Promise<ReportContent> {
  const cooperatives = await prisma.cooperative.findMany({
    where: { deletedAt: null },
    include: { _count: { select: { employees: true } } },
    orderBy: { name: "asc" },
  });

  return {
    docTitle: "Cooperative Listing",
    headers: ["ID", "Name", "Type", "District", "Kebele", "Members", "Employees", "Status"],
    rows: cooperatives.map((c) => [
      c.cooperativeId,
      c.name,
      c.cooperativeType ?? "—",
      c.district ?? "—",
      c.kebele ?? "—",
      c.totalMembers ?? "—",
      c._count.employees,
      c.isActive ? "Active" : "Inactive",
    ]),
    parameters: { totalCooperatives: cooperatives.length },
  };
}

async function buildHeadcountContent(): Promise<ReportContent> {
  const byDept = await prisma.employee.groupBy({
    by: ["department"],
    _count: true,
    where: { deletedAt: null },
  });
  const [total, active] = await Promise.all([
    prisma.employee.count({ where: { deletedAt: null } }),
    prisma.employee.count({ where: { deletedAt: null, employmentStatus: "ACTIVE" } }),
  ]);

  return {
    docTitle: "Headcount Report",
    headers: ["Department", "Employee Count"],
    rows: byDept.map((d) => [d.department ?? "Unassigned", d._count]),
    parameters: { total, active },
  };
}

async function buildAuditLogContent(): Promise<ReportContent> {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { user: { select: { name: true } } },
  });

  return {
    docTitle: "Audit Log (most recent 500 entries)",
    headers: ["Date", "User", "Action", "Entity", "Entity ID"],
    rows: logs.map((l) => [
      l.createdAt.toISOString(),
      l.user?.name ?? "System",
      l.action,
      l.entity,
      l.entityId ?? "—",
    ]),
    parameters: { totalEntries: logs.length },
  };
}

async function buildLeaveSummaryContent(filters: LeaveReportFilters = {}): Promise<ReportContent> {
  const andClauses: Prisma.LeaveRequestWhereInput[] = [];

  if (filters.employeeId) andClauses.push({ employeeId: filters.employeeId });
  if (filters.leaveType) andClauses.push({ leaveType: filters.leaveType as LeaveTypeValue });
  if (filters.status) andClauses.push({ status: filters.status as LeaveStatusValue });
  if (filters.startDate) andClauses.push({ startDate: { gte: new Date(`${filters.startDate}T00:00:00.000Z`) } });
  if (filters.endDate) andClauses.push({ endDate: { lte: new Date(`${filters.endDate}T00:00:00.000Z`) } });

  const where: Prisma.LeaveRequestWhereInput = andClauses.length > 0 ? { AND: andClauses } : {};

  const leaves = await prisma.leaveRequest.findMany({
    where,
    include: {
      employee: { select: { employeeId: true, firstName: true, lastName: true, department: true } },
      approver: { select: { name: true } },
    },
    orderBy: { appliedDate: "desc" },
  });

  return {
    docTitle: "Leave Summary",
    headers: [
      "Leave ID",
      "Employee",
      "Department",
      "Leave Type",
      "Start Date",
      "End Date",
      "Days",
      "Status",
      "Applied",
      "Approver",
    ],
    rows: leaves.map((l) => [
      l.leaveId,
      `${l.employee.firstName} ${l.employee.lastName} (${l.employee.employeeId})`,
      l.employee.department ?? "—",
      LEAVE_TYPE_LABELS[l.leaveType as LeaveTypeValue],
      l.startDate.toISOString().slice(0, 10),
      l.endDate.toISOString().slice(0, 10),
      l.totalDays,
      LEAVE_STATUS_LABELS[l.status as LeaveStatusValue],
      l.appliedDate.toISOString().slice(0, 10),
      l.approver?.name ?? "—",
    ]),
    parameters: { totalRequests: leaves.length, filters },
  };
}

async function getReportContent(type: ReportType, filters?: LeaveReportFilters): Promise<ReportContent> {
  switch (type) {
    case "EMPLOYEE_DIRECTORY":
      return buildEmployeeDirectoryContent();
    case "ATTENDANCE_SUMMARY":
      return buildAttendanceSummaryContent();
    case "COOPERATIVE_LISTING":
      return buildCooperativeListingContent();
    case "HEADCOUNT":
      return buildHeadcountContent();
    case "AUDIT_LOG":
      return buildAuditLogContent();
    case "LEAVE_SUMMARY":
      return buildLeaveSummaryContent(filters);
  }
}

// ── File rendering ───────────────────────────────────────────────────────────

function buildPdfBuffer(content: ReportContent): Buffer {
  const doc = new jsPDF({ orientation: content.headers.length > 5 ? "landscape" : "portrait" });

  doc.setFontSize(14);
  doc.text(content.docTitle, 14, 15);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleString()}`, 14, 21);

  autoTable(doc, {
    startY: 26,
    head: [content.headers],
    body: content.rows.map((row) => row.map((cell) => String(cell))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [41, 98, 71] },
  });

  return Buffer.from(doc.output("arraybuffer"));
}

async function buildCsvBuffer(content: ReportContent): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Report");
  sheet.addRow(content.headers);
  content.rows.forEach((row) => sheet.addRow(row));
  const buffer = await workbook.csv.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}

export async function buildReportFile(
  type: ReportType,
  format: ReportFormat,
  filters?: LeaveReportFilters
): Promise<{
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  parameters: Record<string, unknown>;
}> {
  const content = await getReportContent(type, filters);
  const datePart = new Date().toISOString().slice(0, 10);
  const safeTitle = content.docTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  if (format === "CSV") {
    const buffer = await buildCsvBuffer(content);
    return {
      buffer,
      mimeType: "text/csv",
      fileName: `${safeTitle}-${datePart}.csv`,
      parameters: content.parameters,
    };
  }

  const buffer = buildPdfBuffer(content);
  return {
    buffer,
    mimeType: "application/pdf",
    fileName: `${safeTitle}-${datePart}.pdf`,
    parameters: content.parameters,
  };
}