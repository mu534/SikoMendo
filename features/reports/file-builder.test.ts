import { describe, it, expect } from "vitest";
import { getReportStrings } from "./file-builder";

// server-only is aliased to a no-op stub in vitest.config.ts — no vi.mock needed.

describe("getReportStrings", () => {
  it("returns English strings for locale 'en'", () => {
    const s = getReportStrings("en");
    expect(s.docTitles.employeeDirectory).toBe("Employee Directory");
    expect(s.headers.employeeId).toBe("Employee ID");
    expect(s.headers.checkIn).toBe("Check In");
  });

  it("returns Afaan Oromoo strings for locale 'om'", () => {
    const s = getReportStrings("om");
    expect(s.docTitles.employeeDirectory).toBe("Galmee Hojjettootaa");
    expect(s.headers.employeeId).toBe("ID Hojjetaa");
    expect(s.headers.checkIn).toBe("Seenuu");
  });

  it("resolves employment status labels in English", () => {
    const s = getReportStrings("en");
    expect(s.statusLabels.employmentStatus["ACTIVE"]).toBe("Active");
    expect(s.statusLabels.employmentStatus["ON_LEAVE"]).toBe("On Leave");
    expect(s.statusLabels.employmentStatus["TERMINATED"]).toBe("Terminated");
  });

  it("resolves employment status labels in Afaan Oromoo", () => {
    const s = getReportStrings("om");
    expect(s.statusLabels.employmentStatus["ACTIVE"]).toBe("Socho\u2019aa");
    expect(s.statusLabels.employmentStatus["TERMINATED"]).toBe("Hojii Irraa Ari\u2019ame");
  });

  it("resolves attendance status labels", () => {
    const s = getReportStrings("om");
    expect(s.statusLabels.attendanceStatus["PRESENT"]).toBe("Argame");
    expect(s.statusLabels.attendanceStatus["HALF_DAY"]).toBe("Walakkaa Guyyaa");
  });

  it("resolves cooperative status labels", () => {
    const s = getReportStrings("en");
    expect(s.statusLabels.cooperativeStatus["active"]).toBe("Active");
    const som = getReportStrings("om");
    expect(som.statusLabels.cooperativeStatus["inactive"]).toBe("Socho\u2019aa Miti");
  });

  it("generatedAt template works", () => {
    const s = getReportStrings("en");
    expect(s.docTitles.generatedAt("2024-01-01")).toBe("Generated 2024-01-01");
    const som = getReportStrings("om");
    expect(som.docTitles.generatedAt("2024-01-01")).toBe("Guyyaa 2024-01-01 Uumame");
  });

  it("withFilters template works", () => {
    const s = getReportStrings("en");
    expect(s.docTitles.withFilters("Employee Directory", "2024")).toBe("Employee Directory \u2014 2024");
  });

  it("resolves leave type labels in English", () => {
    const s = getReportStrings("en");
    expect(s.statusLabels.leaveType["ANNUAL"]).toBe("Annual Leave");
    expect(s.statusLabels.leaveType["SICK"]).toBe("Sick Leave");
  });

  it("resolves leave type labels in Afaan Oromoo", () => {
    const s = getReportStrings("om");
    expect(s.statusLabels.leaveType["ANNUAL"]).toBe("Hayyama waggaa");
    expect(s.statusLabels.leaveType["MATERNITY"]).toBe("Hayyama da\u2019umsaa haadha");
  });

  it("resolves leave status labels", () => {
    const s = getReportStrings("om");
    expect(s.statusLabels.leaveStatus["PENDING"]).toBe("Eegamaa jira");
    expect(s.statusLabels.leaveStatus["APPROVED"]).toBe("Eeyyamame");
  });

  it("resolves employment type labels in Afaan Oromoo", () => {
    const s = getReportStrings("om");
    expect(s.statusLabels.employmentType["PERMANENT"]).toBe("Dhaabbataa");
    expect(s.statusLabels.employmentType["INTERNSHIP"]).toBe("Leenjii");
  });

  it("withFilters template works in Afaan Oromoo", () => {
    const s = getReportStrings("om");
    const result = s.docTitles.withFilters(s.docTitles.employeeDirectory, "2024");
    expect(result).toBe("Galmee Hojjettootaa \u2014 2024");
  });
});
