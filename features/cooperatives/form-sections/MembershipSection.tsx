"use client";

import { Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input, Label, FieldGroup, FieldError } from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import { RequiredMark, SectionHeader } from "../form-utils";

type Props = {
  totalMembers: string;
  maleMembers: string;
  femaleMembers: string;
  memberMismatch: boolean;
  onTotalChange: (v: string) => void;
  onMaleChange: (v: string) => void;
  onFemaleChange: (v: string) => void;
};

export function MembershipSection({
  totalMembers, maleMembers, femaleMembers,
  memberMismatch, onTotalChange, onMaleChange, onFemaleChange,
}: Props) {
  const t = useTranslations("cooperatives.form");
  const tV = useTranslations("validation");

  return (
    <Card className="p-6">
      <SectionHeader icon={Users} title={t("membershipInfo")} />
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="totalMembers">{t("totalMembers")}<RequiredMark /></Label>
            <Input id="totalMembers" name="totalMembers" type="number" min="0" step="1" required aria-required="true" value={totalMembers} onChange={(e) => onTotalChange(e.target.value)} />
            {memberMismatch && <FieldError>{tV("memberCountMismatch")}</FieldError>}
          </FieldGroup>

          <div className="hidden sm:block" aria-hidden="true" />

          <FieldGroup>
            <Label htmlFor="maleMembers">{t("maleMembers")}<RequiredMark /></Label>
            <Input id="maleMembers" name="maleMembers" type="number" min="0" step="1" required aria-required="true" value={maleMembers} onChange={(e) => onMaleChange(e.target.value)} />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="femaleMembers">{t("femaleMembers")}<RequiredMark /></Label>
            <Input id="femaleMembers" name="femaleMembers" type="number" min="0" step="1" required aria-required="true" value={femaleMembers} onChange={(e) => onFemaleChange(e.target.value)} />
          </FieldGroup>
        </div>
      </div>
    </Card>
  );
}
