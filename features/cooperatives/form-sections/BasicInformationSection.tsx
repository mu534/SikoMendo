"use client";

import { Building2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input, Label, Select, FieldGroup } from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import { RequiredMark, SectionHeader, toDateInputValue } from "../form-utils";
import type { CooperativeFormValues } from "../form-utils";

type Props = {
  cooperative?: CooperativeFormValues;
  cooperativeId?: string;
  onNameChange?: (v: string) => void;
};

export function BasicInformationSection({ cooperative, cooperativeId, onNameChange }: Props) {
  const t = useTranslations("cooperatives.form");
  const tC = useTranslations("common");
  const tF = useTranslations("cooperatives.filters");

  return (
    <Card className="p-6">
      <SectionHeader icon={Building2} title={t("basicInfo")} />
      <div className="space-y-5">

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="cooperativeId_display">{t("cooperativeId")}</Label>
            <Input
              id="cooperativeId_display"
              readOnly
              tabIndex={-1}
              aria-readonly="true"
              value={cooperative?.cooperativeId ?? cooperativeId ?? tC("loading")}
              className="cursor-default bg-sand-100"
            />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="name">{t("cooperativeName")}<RequiredMark /></Label>
            <Input
              id="name"
              name="name"
              required
              aria-required="true"
              defaultValue={cooperative?.name ?? ""}
              onChange={onNameChange ? (e) => onNameChange(e.target.value) : undefined}
            />
          </FieldGroup>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="cooperativeType">{t("cooperativeType")}<RequiredMark /></Label>
            <Select id="cooperativeType" name="cooperativeType" required aria-required="true" defaultValue={cooperative?.cooperativeType ?? ""}>
              <option value="">{tC("type")}</option>
              <option value="Agricultural">{tF("typeAgricultural")}</option>
              <option value="Savings & Credit">{tF("typeSavingsCredit")}</option>
              <option value="Consumer">{tF("typeConsumer")}</option>
              <option value="Marketing">{tF("typeMarketing")}</option>
              <option value="Service">{tF("typeService")}</option>
              <option value="Multi-Purpose">{tF("typeMultiPurpose")}</option>
            </Select>
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="registrationNumber">{t("registrationNumber")}<RequiredMark /></Label>
            <Input id="registrationNumber" name="registrationNumber" required aria-required="true" defaultValue={cooperative?.registrationNumber ?? ""} />
          </FieldGroup>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="registrationDate">{t("registrationDate")}<RequiredMark /></Label>
            <Input id="registrationDate" name="registrationDate" type="date" required aria-required="true" defaultValue={toDateInputValue(cooperative?.registrationDate)} />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="dateJoinedUnion">{t("dateJoinedUnion")}<RequiredMark /></Label>
            <Input id="dateJoinedUnion" name="dateJoinedUnion" type="date" required aria-required="true" defaultValue={toDateInputValue(cooperative?.dateJoinedUnion)} />
          </FieldGroup>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="isActive">{tC("status")}<RequiredMark /></Label>
            <Select id="isActive" name="isActive" required aria-required="true" defaultValue={cooperative?.isActive === false ? "false" : "true"}>
              <option value="true">{tC("active")}</option>
              <option value="false">{tC("inactive")}</option>
            </Select>
          </FieldGroup>
        </div>
      </div>
    </Card>
  );
}
