"use client";

import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input, Label, FieldGroup } from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import { RequiredMark, SectionHeader } from "../form-utils";
import type { CooperativeFormValues } from "../form-utils";

type Props = {
  cooperative?: CooperativeFormValues;
  onDistrictChange?: (v: string) => void;
};

export function AddressInformationSection({ cooperative, onDistrictChange }: Props) {
  const t = useTranslations("cooperatives.form");

  return (
    <Card className="p-6">
      <SectionHeader icon={MapPin} title={t("addressInfo")} />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FieldGroup>
          <Label htmlFor="district">{t("district")}<RequiredMark /></Label>
          <Input
            id="district"
            name="district"
            required
            aria-required="true"
            defaultValue={cooperative?.district ?? ""}
            onChange={onDistrictChange ? (e) => onDistrictChange(e.target.value) : undefined}
          />
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="kebele">{t("kebele")}<RequiredMark /></Label>
          <Input id="kebele" name="kebele" required aria-required="true" defaultValue={cooperative?.kebele ?? ""} />
        </FieldGroup>
      </div>
    </Card>
  );
}
