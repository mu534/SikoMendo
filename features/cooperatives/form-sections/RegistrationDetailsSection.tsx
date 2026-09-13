"use client";

import { FileText } from "lucide-react";
import { Input, Label, FieldGroup } from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import { RequiredMark, SectionHeader } from "../form-utils";
import type { CooperativeFormValues } from "../form-utils";

type Props = {
  cooperative?: CooperativeFormValues;
  numShares: string;
  priceShare: string;
  totalShareValue: number | null;
  onNumSharesChange: (v: string) => void;
  onPriceShareChange: (v: string) => void;
};

/**
 * Section 3 of CooperativeForm: Registration Details.
 * businessType and registrationFee use defaultValue (uncontrolled).
 * numberOfShares and pricePerShare are controlled so the parent can derive
 * the auto-calculated totalShareValue.
 */
export function RegistrationDetailsSection({
  cooperative,
  numShares,
  priceShare,
  totalShareValue,
  onNumSharesChange,
  onPriceShareChange,
}: Props) {
  return (
    <Card className="p-6">
      <SectionHeader icon={FileText} title="Registration Details" />
      <div className="space-y-5">

        {/* Row: Business Type* + Registration Fee* */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="businessType">
              Business Type / Gosa Hojii<RequiredMark />
            </Label>
            <Input
              id="businessType"
              name="businessType"
              required
              aria-required="true"
              defaultValue={cooperative?.businessType ?? ""}
            />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="registrationFee">
              Registration Fee / Kaffaltii Galmee<RequiredMark />
            </Label>
            <Input
              id="registrationFee"
              name="registrationFee"
              type="number"
              min="0"
              step="0.01"
              required
              aria-required="true"
              defaultValue={
                cooperative?.registrationFee != null
                  ? String(cooperative.registrationFee)
                  : ""
              }
            />
          </FieldGroup>
        </div>

        {/* Row: Number of Shares* + Price Per Share* */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="numberOfShares">
              Number of Shares / Qooda Bitataa<RequiredMark />
            </Label>
            <Input
              id="numberOfShares"
              name="numberOfShares"
              type="number"
              min="0"
              step="1"
              required
              aria-required="true"
              value={numShares}
              onChange={(e) => onNumSharesChange(e.target.value)}
            />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="pricePerShare">
              Price Per Share / Gatii Qooda Tokkoo<RequiredMark />
            </Label>
            <Input
              id="pricePerShare"
              name="pricePerShare"
              type="number"
              min="0"
              step="0.01"
              required
              aria-required="true"
              value={priceShare}
              onChange={(e) => onPriceShareChange(e.target.value)}
            />
          </FieldGroup>
        </div>

        {/* Total Share Value — read-only, auto-calculated */}
        <FieldGroup>
          <Label htmlFor="totalShareValue">Total Share Value (auto-calculated)</Label>
          <Input
            id="totalShareValue"
            readOnly
            tabIndex={-1}
            aria-readonly="true"
            className="cursor-default bg-sand-100"
            value={
              totalShareValue != null
                ? totalShareValue.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                : ""
            }
            placeholder="Calculated from shares × price per share"
          />
        </FieldGroup>
      </div>
    </Card>
  );
}
