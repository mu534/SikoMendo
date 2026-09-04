import "server-only";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import prisma from "@/lib/prisma";
import {
  LEAVE_TYPE_LABELS,
  LEAVE_STATUS_LABELS,
  type LeaveStatusValue,
  type LeaveTypeValue,
} from "@/features/leave/schemas";
import type { ReportType, ReportFormat, Prisma } from "@prisma/client";

// ── Filter types ─────────────────────────────────────────────────────────────

export type ReportFilters = {
  // Common
  departmentId?: string;
  employeeId?: string;
  year?: string;
  startDate?: string;
  endDate?: string;
  // Employee / Headcount
  employmentStatus?: string;
  employmentType?: string;
  // Attendance
  attendanceStatus?: string;
  // Leave
  leaveType?: string;
  leaveStatus?: string;
  // Cooperative
  cooperativeStatus?: string;  // "active" | "inactive"
  cooperativeType?: string;
  /**
   * Server-injected by generateReport() for MANAGER role.
   * When present, every employee-scoped query must restrict itself to this
   * set of IDs regardless of what the client submitted as employeeId or
   * departmentId. Null/undefined means unrestricted (Admin / HR Officer).
   */
  allowedEmployeeIds?: string[];
};

// ── Date helpers ─────────────────────────────────────────────────────────────

/** Start of day UTC for a yyyy-mm-dd string. */
function dayStart(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/** End of day UTC for a yyyy-mm-dd string (23:59:59.999). */
function dayEnd(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999Z`);
}

/** Jan 1 00:00:00 UTC of the given year. */
function yearStart(year: number): Date {
  return new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
}

/** Dec 31 23:59:59 UTC of the given year. */
function yearEnd(year: number): Date {
  return new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
}

/**
 * Resolve the effective [gte, lte] date range from filter inputs.
 * Priority: explicit startDate/endDate > year > no constraint.
 */
function resolveDateRange(
  filters: ReportFilters
): { gte?: Date; lte?: Date } {
  if (filters.startDate || filters.endDate) {
    return {
      gte: filters.startDate ? dayStart(filters.startDate) : undefined,
      lte: filters.endDate ? dayEnd(filters.endDate) : undefined,
    };
  }
  if (filters.year) {
    const y = parseInt(filters.year, 10);
    if (!isNaN(y)) return { gte: yearStart(y), lte: yearEnd(y) };
  }
  return {};
}

// ── Shared report content shape ───────────────────────────────────────────────

type ReportContent = {
  docTitle: string;
  headers: string[];
  rows: (string | number)[][];
  parameters: Record<string, unknown>;
};

// ── Per-type data gathering ───────────────────────────────────────────────────

async function buildEmployeeDirectoryContent(
  filters: ReportFilters
): Promise<ReportContent> {
  const andClauses: Prisma.EmployeeWhereInput[] = [{ deletedAt: null }];

  // Manager scope: restrict to authorised employee IDs before any other filter
  if (filters.allowedEmployeeIds) {
    andClauses.push({ id: { in: filters.allowedEmployeeIds } });
  }

  if (filters.departmentId) andClauses.push({ departmentId: filters.departmentId });
  if (filters.employeeId) andClauses.push({ id: filters.employeeId });
  if (filters.employmentStatus) andClauses.push({ employmentStatus: filters.employmentStatus as Prisma.EnumEmploymentStatusFilter["equals"] });
  if (filters.employmentType) andClauses.push({ employmentType: filters.employmentType as Prisma.EnumEmploymentTypeNullableFilter["equals"] });

  // Year / date range on hireDate
  const dateRange = resolveDateRange(filters);
  if (dateRange.gte || dateRange.lte) {
    andClauses.push({ hireDate: dateRange });
  }

  const employees = await prisma.employee.findMany({
    where: { AND: andClauses },
    include: {
      department: { select: { name: true } },
      position: { select: { name: true } },
    },
    orderBy: [{ department: { name: "asc" } }, { firstName: "asc" }],
  });

  const descParts: string[] = [];
  if (filters.departmentId) descParts.push("department filter");
  if (filters.employmentStatus) descParts.push(filters.employmentStatus.replace("_", " "));
  if (filters.year) descParts.push(filters.year);
  if (filters.startDate || filters.endDate)
    descParts.push(`${filters.startDate ?? ""}–${filters.endDate ?? ""}`);

  return {
    docTitle: descParts.length
      ? `Employee Directory — ${descParts.join(", ")}`
      : "Employee Directory",
    headers: [
      "Employee ID", "Name", "Department", "Position",
      "Status", "Type", "Hire Date", "Phone", "Email",
    ],
    rows: employees.map((e) => [
      e.employeeId,
      `${e.firstName}${e.middleName ? ` ${e.middleName}` : ""} ${e.lastName}`,
      e.department.name,
      e.position.name,
      e.employmentStatus.replace(/_/g, " "),
      e.employmentType?.replace(/_/g, " ") ?? "—",
      e.hireDate ? e.hireDate.toISOString().slice(0, 10) : "—",
      e.phone ?? "—",
      e.email ?? "—",
    ]),
    parameters: {
      totalEmployees: employees.length,
      filters: {
        departmentId: filters.departmentId,
        employeeId: filters.employeeId,
        employmentStatus: filters.employmentStatus,
        employmentType: filters.employmentType,
        year: filters.year,
        startDate: filters.startDate,
        endDate: filters.endDate,
      },
    },
  };
}

async function buildAttendanceSummaryContent(
  filters: ReportFilters
): Promise<ReportContent> {
  const andClauses: Prisma.AttendanceWhereInput[] = [];

  // Manager scope
  if (filters.allowedEmployeeIds) {
    andClauses.push({ employeeId: { in: filters.allowedEmployeeIds } });
  }

  if (filters.employeeId) andClauses.push({ employeeId: filters.employeeId });
  if (filters.departmentId) andClauses.push({ employee: { departmentId: filters.departmentId } });
  if (filters.attendanceStatus) andClauses.push({ status: filters.attendanceStatus as Prisma.EnumAttendanceStatusFilter["equals"] });

  const dateRange = resolveDateRange(filters);
  if (dateRange.gte || dateRange.lte) {
    andClauses.push({ date: dateRange });
  }

  const where: Prisma.AttendanceWhereInput =
    andClauses.length > 0 ? { AND: andClauses } : {};

  const records = await prisma.attendance.findMany({
    where,
    include: {
      employee: {
        select: {
          employeeId: true,
          firstName: true,
          lastName: true,
          department: { select: { name: true } },
        },
      },
    },
    orderBy: [{ date: "desc" }, { employee: { firstName: "asc" } }],
  });

  const descParts: string[] = [];
  if (filters.departmentId) descParts.push("department filter");
  if (filters.employeeId) descParts.push("employee filter");
  if (filters.attendanceStatus) descParts.push(filters.attendanceStatus.replace("_", " "));
  if (filters.year) descParts.push(filters.year);
  if (filters.startDate || filters.endDate)
    descParts.push(`${filters.startDate ?? ""}–${filters.endDate ?? ""}`);

  return {
    docTitle: descParts.length
      ? `Attendance Summary — ${descParts.join(", ")}`
      : "Attendance Summary",
    headers: [
      "Date", "Employee ID", "Name", "Department",
      "Status", "Check-in", "Check-out", "Notes",
    ],
    rows: records.map((a) => [
      a.date.toISOString().slice(0, 10),
      a.employee.employeeId,
      `${a.employee.firstName} ${a.employee.lastName}`,
      a.employee.department.name,
      a.status.replace(/_/g, " "),
      a.checkIn ? a.checkIn.toISOString().slice(11, 16) : "—",
      a.checkOut ? a.checkOut.toISOString().slice(11, 16) : "—",
      a.notes ?? "—",
    ]),
    parameters: {
      totalRecords: records.length,
      filters: {
        employeeId: filters.employeeId,
        departmentId: filters.departmentId,
        attendanceStatus: filters.attendanceStatus,
        year: filters.year,
        startDate: filters.startDate,
        endDate: filters.endDate,
      },
    },
  };
}

async function buildCooperativeListingContent(
  filters: ReportFilters
): Promise<ReportContent> {
  const andClauses: Prisma.CooperativeWhereInput[] = [{ deletedAt: null }];

  if (filters.cooperativeStatus === "active") andClauses.push({ isActive: true });
  if (filters.cooperativeStatus === "inactive") andClauses.push({ isActive: false });
  if (filters.cooperativeType) andClauses.push({ cooperativeType: { equals: filters.cooperativeType, mode: "insensitive" } });

  // Year / date range on registrationDate
  const dateRange = resolveDateRange(filters);
  if (dateRange.gte || dateRange.lte) {
    andClauses.push({ registrationDate: dateRange });
  }

  const cooperatives = await prisma.cooperative.findMany({
    where: { AND: andClauses },
    orderBy: { name: "asc" },
  });

  const descParts: string[] = [];
  if (filters.cooperativeStatus) descParts.push(filters.cooperativeStatus);
  if (filters.cooperativeType) descParts.push(filters.cooperativeType);
  if (filters.year) descParts.push(filters.year);

  return {
    docTitle: descParts.length
      ? `Cooperative Listing — ${descParts.join(", ")}`
      : "Cooperative Listing",
    headers: [
      "Coop ID", "Name", "Type", "District", "Kebele",
      "Reg. Number", "Members", "Status",
    ],
    rows: cooperatives.map((c) => [
      c.cooperativeId,
      c.name,
      c.cooperativeType ?? "—",
      c.district ?? "—",
      c.kebele ?? "—",
      c.registrationNumber ?? "—",
      c.totalMembers ?? "—",
      c.isActive ? "Active" : "Inactive",
    ]),
    parameters: {
      totalCooperatives: cooperatives.length,
      filters: {
        cooperativeStatus: filters.cooperativeStatus,
        cooperativeType: filters.cooperativeType,
        year: filters.year,
        startDate: filters.startDate,
        endDate: filters.endDate,
      },
    },
  };
}

async function buildHeadcountContent(
  filters: ReportFilters
): Promise<ReportContent> {
  const andClauses: Prisma.EmployeeWhereInput[] = [{ deletedAt: null }];

  // Manager scope
  if (filters.allowedEmployeeIds) {
    andClauses.push({ id: { in: filters.allowedEmployeeIds } });
  }

  if (filters.departmentId) andClauses.push({ departmentId: filters.departmentId });
  if (filters.employmentStatus) andClauses.push({ employmentStatus: filters.employmentStatus as Prisma.EnumEmploymentStatusFilter["equals"] });
  if (filters.employmentType) andClauses.push({ employmentType: filters.employmentType as Prisma.EnumEmploymentTypeNullableFilter["equals"] });

  const dateRange = resolveDateRange(filters);
  if (dateRange.gte || dateRange.lte) {
    andClauses.push({ hireDate: dateRange });
  }

  const where: Prisma.EmployeeWhereInput = { AND: andClauses };

  // If filtering by a specific department, show per-position counts
  if (filters.departmentId) {
    const positions = await prisma.position.findMany({
      where: { departmentId: filters.departmentId, isActive: true },
      include: {
        _count: { select: { employees: { where } } },
      },
      orderBy: { name: "asc" },
    });
    const total = positions.reduce((s, p) => s + p._count.employees, 0);

    return {
      docTitle: "Headcount Report",
      headers: ["Position", "Employee Count"],
      rows: positions.map((p) => [p.name, p._count.employees]),
      parameters: { total, filters },
    };
  }

  // Otherwise show per-department summary
  const departments = await prisma.department.findMany({
    include: { _count: { select: { employees: { where } } } },
    orderBy: { name: "asc" },
  });
  const total = departments.reduce((s, d) => s + d._count.employees, 0);

  return {
    docTitle: "Headcount Report",
    headers: ["Department", "Employee Count"],
    rows: departments.map((d) => [d.name, d._count.employees]),
    parameters: {
      total,
      filters: {
        departmentId: filters.departmentId,
        employmentStatus: filters.employmentStatus,
        employmentType: filters.employmentType,
        year: filters.year,
        startDate: filters.startDate,
        endDate: filters.endDate,
      },
    },
  };
}

async function buildAuditLogContent(
  filters: ReportFilters
): Promise<ReportContent> {
  const andClauses: Prisma.AuditLogWhereInput[] = [];

  const dateRange = resolveDateRange(filters);
  if (dateRange.gte || dateRange.lte) {
    andClauses.push({ createdAt: dateRange });
  }

  const where: Prisma.AuditLogWhereInput =
    andClauses.length > 0 ? { AND: andClauses } : {};

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 1000,
    include: { user: { select: { name: true } } },
  });

  const descParts: string[] = [];
  if (filters.year) descParts.push(filters.year);
  if (filters.startDate || filters.endDate)
    descParts.push(`${filters.startDate ?? ""}–${filters.endDate ?? ""}`);

  return {
    docTitle: descParts.length
      ? `Audit Log — ${descParts.join(", ")}`
      : "Audit Log (most recent 1 000 entries)",
    headers: ["Date", "User", "Action", "Entity", "Entity ID"],
    rows: logs.map((l) => [
      l.createdAt.toISOString().replace("T", " ").slice(0, 16),
      l.user?.name ?? "System",
      l.action,
      l.entity,
      l.entityId ?? "—",
    ]),
    parameters: {
      totalEntries: logs.length,
      filters: { year: filters.year, startDate: filters.startDate, endDate: filters.endDate },
    },
  };
}

async function buildLeaveSummaryContent(
  filters: ReportFilters
): Promise<ReportContent> {
  const andClauses: Prisma.LeaveRequestWhereInput[] = [];

  // Manager scope
  if (filters.allowedEmployeeIds) {
    andClauses.push({ employeeId: { in: filters.allowedEmployeeIds } });
  }

  if (filters.employeeId) andClauses.push({ employeeId: filters.employeeId });
  if (filters.departmentId) andClauses.push({ employee: { departmentId: filters.departmentId } });
  if (filters.leaveType) andClauses.push({ leaveType: filters.leaveType as LeaveTypeValue });
  if (filters.leaveStatus) andClauses.push({ status: filters.leaveStatus as LeaveStatusValue });

  // Date range / year: filter on the leave startDate
  const dateRange = resolveDateRange(filters);
  if (dateRange.gte || dateRange.lte) {
    andClauses.push({ startDate: dateRange });
  }

  const where: Prisma.LeaveRequestWhereInput =
    andClauses.length > 0 ? { AND: andClauses } : {};

  const leaves = await prisma.leaveRequest.findMany({
    where,
    include: {
      employee: {
        select: {
          employeeId: true,
          firstName: true,
          lastName: true,
          department: { select: { name: true } },
        },
      },
      approver: { select: { name: true } },
    },
    orderBy: { appliedDate: "desc" },
  });

  const descParts: string[] = [];
  if (filters.departmentId) descParts.push("department filter");
  if (filters.employeeId) descParts.push("employee filter");
  if (filters.leaveType) descParts.push(LEAVE_TYPE_LABELS[filters.leaveType as LeaveTypeValue] ?? filters.leaveType);
  if (filters.leaveStatus) descParts.push(LEAVE_STATUS_LABELS[filters.leaveStatus as LeaveStatusValue] ?? filters.leaveStatus);
  if (filters.year) descParts.push(filters.year);
  if (filters.startDate || filters.endDate)
    descParts.push(`${filters.startDate ?? ""}–${filters.endDate ?? ""}`);

  return {
    docTitle: descParts.length
      ? `Leave Summary — ${descParts.join(", ")}`
      : "Leave Summary",
    headers: [
      "Leave ID", "Employee", "Department",
      "Leave Type", "Start Date", "End Date", "Days",
      "Status", "Applied", "Approver",
    ],
    rows: leaves.map((l) => [
      l.leaveId,
      `${l.employee.firstName} ${l.employee.lastName} (${l.employee.employeeId})`,
      l.employee.department.name,
      LEAVE_TYPE_LABELS[l.leaveType as LeaveTypeValue] ?? l.leaveType,
      l.startDate.toISOString().slice(0, 10),
      l.endDate.toISOString().slice(0, 10),
      l.totalDays,
      LEAVE_STATUS_LABELS[l.status as LeaveStatusValue] ?? l.status,
      l.appliedDate.toISOString().slice(0, 10),
      l.approver?.name ?? "—",
    ]),
    parameters: {
      totalRequests: leaves.length,
      filters: {
        employeeId: filters.employeeId,
        departmentId: filters.departmentId,
        leaveType: filters.leaveType,
        leaveStatus: filters.leaveStatus,
        year: filters.year,
        startDate: filters.startDate,
        endDate: filters.endDate,
      },
    },
  };
}

async function getReportContent(
  type: ReportType,
  filters: ReportFilters
): Promise<ReportContent> {
  switch (type) {
    case "EMPLOYEE_DIRECTORY":
      return buildEmployeeDirectoryContent(filters);
    case "ATTENDANCE_SUMMARY":
      return buildAttendanceSummaryContent(filters);
    case "COOPERATIVE_LISTING":
      return buildCooperativeListingContent(filters);
    case "HEADCOUNT":
      return buildHeadcountContent(filters);
    case "AUDIT_LOG":
      return buildAuditLogContent(filters);
    case "LEAVE_SUMMARY":
      return buildLeaveSummaryContent(filters);
  }
}

// ── File renderers ────────────────────────────────────────────────────────────

function buildPdfBuffer(content: ReportContent): Buffer {
  const doc = new jsPDF({
    orientation: content.headers.length > 6 ? "landscape" : "portrait",
  });

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
    headStyles: { fillColor: [28, 82, 53] }, // brand-700
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

// ── Public entry point ────────────────────────────────────────────────────────

export async function buildReportFile(
  type: ReportType,
  format: ReportFormat,
  filters: ReportFilters = {}
): Promise<{
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  parameters: Record<string, unknown>;
  docTitle: string;
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
      docTitle: content.docTitle,
    };
  }

  const buffer = buildPdfBuffer(content);
  return {
    buffer,
    mimeType: "application/pdf",
    fileName: `${safeTitle}-${datePart}.pdf`,
    parameters: content.parameters,
    docTitle: content.docTitle,
  };
}
