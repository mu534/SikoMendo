"use client";

import { FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input, Label, FieldGroup } from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import { RequiredMark, SectionHeader } from "../form-utils";
import { LegalCertificateSection } from "./LegalCertificateSection";
import type { CooperativeFormValues } from "../form-utils";

type Props = {
  cooperative?: CooperativeFormValues;
  numShares: string;
  priceShare: string;
  totalShareValue: number | null;
  onNumSharesChange: (v: string) => void;
  onPriceShareChange: (v: string) => void;
  isCreate?: boolean;
  onCertChange?: (uploaded: boolean) => void;
};

export function RegistrationDetailsSection({
  cooperative, numShares, priceShare, totalShareValue,
  onNumSharesChange, onPriceShareChange, isCreate = false, onCertChange,
}: Props) {
  const t = useTranslations("cooperatives.form");
  const tC = useTranslations("common");

  const existingCert = cooperative?.legalCertificateFileName
    ? { fileName: cooperative.legalCertificateFileName, fileSize: cooperative.legalCertificateFileSize ?? 0, viewUrl: cooperative.legalCertificateViewUrl ?? null }
    : null;

  return (
    <Card className="p-6">
      <SectionHeader icon={FileText} title={t("registrationDetails")} />
      <div className="space-y-5">

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="businessType">{t("businessType")}<RequiredMark /></Label>
            <Input id="businessType" name="businessType" required aria-required="true" defaultValue={cooperative?.businessType ?? ""} />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="registrationFee">{t("registrationFee")}<RequiredMark /></Label>
            <Input id="registrationFee" name="registrationFee" type="number" min="0" step="0.01" required aria-required="true" defaultValue={cooperative?.registrationFee != null ? String(cooperative.registrationFee) : ""} />
          </FieldGroup>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="numberOfShares">{t("numberOfShares")}<RequiredMark /></Label>
            <Input id="numberOfShares" name="numberOfShares" type="number" min="0" step="1" required aria-required="true" value={numShares} onChange={(e) => onNumSharesChange(e.target.value)} />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="pricePerShare">{t("pricePerShare")}<RequiredMark /></Label>
            <Input id="pricePerShare" name="pricePerShare" type="number" min="0" step="0.01" required aria-required="true" value={priceShare} onChange={(e) => onPriceShareChange(e.target.value)} />
          </FieldGroup>
        </div>

        <FieldGroup>
          <Label htmlFor="totalShareValue">{tC("total")}</Label>
          <Input
            id="totalShareValue"
            readOnly
            tabIndex={-1}
            aria-readonly="true"
            className="cursor-default bg-sand-100"
            value={totalShareValue != null ? totalShareValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}
            placeholder={tC("loading")}
          />
        </FieldGroup>

        <LegalCertificateSection existing={existingCert} isCreate={isCreate} onCertChange={onCertChange} />
      </div>
    </Card>
  );
}
