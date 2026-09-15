"use client";

import { MapPin } from "lucide-react";
import { Input, Label, FieldGroup } from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import { RequiredMark, SectionHeader } from "../form-utils";
import type { CooperativeFormValues } from "../form-utils";

type Props = {
  cooperative?: CooperativeFormValues;
  onDistrictChange?: (v: string) => void;
};

/**
 * Section 2 of CooperativeForm: Address Information.
 * Contains district (Aanaa) and ganda — both required.
 */
export function AddressInformationSection({ cooperative, onDistrictChange }: Props) {
  return (
    <Card className="p-6">
      <SectionHeader icon={MapPin} title="Address Information" />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FieldGroup>
          <Label htmlFor="district">
            District / Aanaa<RequiredMark />
          </Label>
          <Input
            id="district"
            name="district"
            required
            aria-required="true"
            defaultValue={cooperative?.district ?? ""}
            placeholder="e.g. Goba"
            onChange={onDistrictChange ? (e) => onDistrictChange(e.target.value) : undefined}
          />
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="kebele">
            Ganda<RequiredMark />
          </Label>
          <Input
            id="kebele"
            name="kebele"
            required
            aria-required="true"
            defaultValue={cooperative?.kebele ?? ""}
            placeholder="e.g. Horabooqa"
          />
        </FieldGroup>
      </div>
    </Card>
  );
}
