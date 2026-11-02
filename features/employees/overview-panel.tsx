"use client";

import { useState } from "react";
import { Pencil, User, Phone, Briefcase, GraduationCap, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "./section-header";
import { EmployeeForm } from "./employee-form";
import type { EmployeeFormValues, DepartmentOption, PositionOption, ManagerOption } from "./employee-form";

type ReadFieldProps = {
  label: string;
  value?: string | null;
  className?: string;
};

function ReadField({ label, value, className }: ReadFieldProps) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-900/40">{label}</dt>
      <dd className="mt-1 text-sm text-ink-900/80">{value || "—"}</dd>
    </div>
  );
}

type EducationRecord = {
  id?: string;
  educationLevel: string;
  fieldOfStudy?: string | null;
  institutionType?: string | null;
  institutionName?: string | null;
  graduationYear?: number | null;
  qualificationStatus?: string | null;
};

type OverviewEmployee = {
  id: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  gender?: string | null;
  dateOfBirth?: Date | null;
  maritalStatus?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelationship?: string | null;
  emergencyContactAddress?: string | null;
  educations?: EducationRecord[];
};

const GENDER_LABEL: Record<string, string> = { MALE: "Male", FEMALE: "Female" };
const MARITAL_LABEL: Record<string, string> = {
  SINGLE: "Single", MARRIED: "Married", DIVORCED: "Divorced", WIDOWED: "Widowed",
};
const EDUCATION_LABEL: Record<string, string> = {
  PRIMARY:     "Primary",
  SECONDARY:   "Secondary",
  HIGH_SCHOOL: "High School",
  CERTIFICATE: "Certificate",
  DIPLOMA:     "Diploma",
  BACHELOR:    "Bachelor's Degree",
  MASTER:      "Master's Degree",
  PHD:         "Doctoral Degree (PhD)",
  OTHER:       "Other",
};
const QUALIFICATION_STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: "In Progress",
  COMPLETED:   "Completed",
};

export function OverviewPanel({
  employee,
  formValues,
  canManage,
  departments,
  positions,
  managers,
  updateAction,
}: {
  employee: OverviewEmployee;
  formValues: EmployeeFormValues | null;
  canManage: boolean;
  departments: DepartmentOption[];
  positions: PositionOption[];
  managers: ManagerOption[];
  updateAction: (
    prevState: unknown,
    formData: FormData
  ) => Promise<{ success: boolean; data?: unknown; error?: { message: string } }>;
}) {
  const [editing, setEditing] = useState(false);
  const t = useTranslations("employees");
  const tC = useTranslations("common");

  const fullDob = employee.dateOfBirth
    ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(
        new Date(employee.dateOfBirth)
      )
    : null;

  if (editing && canManage && formValues) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-ink-900">{t("form.editTitle")}</h3>
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)} className="text-ink-900/50">
            <X className="h-4 w-4" />
            {tC("cancel")}
          </Button>
        </div>
        <EmployeeForm
          action={updateAction}
          employee={formValues}
          departments={departments}
          positions={positions}
          managers={managers as ManagerOption[]}
          onSaveSuccess={() => setEditing(false)}
        />
      </div>
    );
  }

  const educations = employee.educations ?? [];

  return (
    <div className="space-y-6">
      {/* Edit button for Admin/HR */}
      {canManage && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
            {t("form.editTitle")}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Personal Information */}
        <Card className="p-5">
          <SectionHeader icon={User} title={t("form.personalInfo")} />
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ReadField label={t("form.gender")} value={t(`form.${employee.gender === "MALE" ? "genderMale" : employee.gender === "FEMALE" ? "genderFemale" : "selectGender"}` as Parameters<typeof t>[0])} />
            <ReadField label={t("form.dateOfBirth")} value={fullDob} />
            <ReadField label={t("form.maritalStatus")} value={t(`form.marital${(employee.maritalStatus ?? "").charAt(0).toUpperCase()}${(employee.maritalStatus ?? "").slice(1).toLowerCase()}` as Parameters<typeof t>[0])} />
            <ReadField label={t("overview.phone")} value={employee.phone} />
            <ReadField label={t("overview.email")} value={employee.email} className="sm:col-span-2" />
            <ReadField label={t("form.address")} value={employee.address} className="sm:col-span-2" />
          </dl>
        </Card>

        {/* Emergency Contact */}
        <Card className="p-5">
          <SectionHeader icon={Phone} title={t("form.emergencyContact")} />
          {employee.emergencyContactName ? (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ReadField label={tC("name")} value={employee.emergencyContactName} />
              <ReadField label={t("form.emergencyContactRelationship")} value={employee.emergencyContactRelationship} />
              <ReadField label={t("overview.phone")} value={employee.emergencyContactPhone} />
              <ReadField label={t("form.address")} value={employee.emergencyContactAddress} />
            </dl>
          ) : (
            <p className="text-sm text-ink-900/40">{tC("noResults")}</p>
          )}
        </Card>

        {/* Education — one card per qualification, full width */}
        <Card className="p-5 lg:col-span-2">
          <SectionHeader icon={GraduationCap} title={t("education.title")} />
          {educations.length === 0 ? (
            <p className="text-sm text-ink-900/40">{tC("noResults")}</p>
          ) : (
            <div className="space-y-4">
              {educations.map((edu, idx) => (
                <div key={edu.id ?? idx} className={idx > 0 ? "border-t border-ink-900/8 pt-4" : ""}>
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <ReadField label={t("education.educationLevel")} value={t(`education.levels.${edu.educationLevel as "HIGH_SCHOOL"|"CERTIFICATE"|"DIPLOMA"|"BACHELOR"|"MASTER"|"PHD"|"OTHER"}`)} />
                    <ReadField label={t("education.fieldOfStudy")} value={edu.fieldOfStudy} />
                    <ReadField label={t("education.institutionName")} value={edu.institutionName} />
                    <ReadField label={t("education.graduationYear")} value={edu.graduationYear != null ? String(edu.graduationYear) : null} />
                    {edu.qualificationStatus && (
                      <ReadField label={t("education.qualificationStatus")} value={t(`education.qualificationStatuses.${edu.qualificationStatus as "IN_PROGRESS"|"COMPLETED"}`)} />
                    )}
                  </dl>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
