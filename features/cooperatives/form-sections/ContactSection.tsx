"use client";

import { Building2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input, Label, Textarea, FieldGroup } from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "../form-utils";
import type { CooperativeFormValues } from "../form-utils";

type Props = {
  cooperative?: CooperativeFormValues;
};

export function ContactSection({ cooperative }: Props) {
  const t = useTranslations("cooperatives.form");
  const tC = useTranslations("common");

  return (
    <Card className="p-6">
      <SectionHeader icon={Building2} title={t("contactInfo")} />
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="contactPerson">{t("contactPerson")}</Label>
            <Input id="contactPerson" name="contactPerson" defaultValue={cooperative?.contactPerson ?? ""} />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="contactEmail">{t("contactEmail")}</Label>
            <Input id="contactEmail" name="contactEmail" type="email" defaultValue={cooperative?.contactEmail ?? ""} />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="contactPhone">{t("contactPhone")}</Label>
            <Input id="contactPhone" name="contactPhone" defaultValue={cooperative?.contactPhone ?? ""} />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="location">{t("location")}</Label>
            <Input id="location" name="location" defaultValue={cooperative?.location ?? ""} />
          </FieldGroup>
        </div>

        <FieldGroup>
          <Label htmlFor="description">{tC("description")}</Label>
          <Textarea id="description" name="description" rows={3} defaultValue={cooperative?.description ?? ""} />
        </FieldGroup>
      </div>
    </Card>
  );
}
