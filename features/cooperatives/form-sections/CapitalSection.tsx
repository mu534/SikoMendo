"use client";

import { Wallet } from "lucide-react";
import { Input, Label, FieldGroup } from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import { RequiredMark, SectionHeader } from "../form-utils";

type Props = {
  fixedAssets: string;
  currentAssets: string;
  totalCapital: number | null;
  onFixedAssetsChange: (v: string) => void;
  onCurrentAssetsChange: (v: string) => void;
};

/**
 * Section 5 of CooperativeForm: Capital Information.
 * fixedAssets and currentAssets are controlled so the parent can derive
 * the auto-calculated totalCapital.
 */
export function CapitalSection({
  fixedAssets,
  currentAssets,
  totalCapital,
  onFixedAssetsChange,
  onCurrentAssetsChange,
}: Props) {
  return (
    <Card className="p-6">
      <SectionHeader icon={Wallet} title="Capital Information" />
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="fixedAssets">
              Fixed Assets / Dhaabbataa<RequiredMark />
            </Label>
            <Input
              id="fixedAssets"
              name="fixedAssets"
              type="number"
              min="0"
              step="0.01"
              required
              aria-required="true"
              value={fixedAssets}
              onChange={(e) => onFixedAssetsChange(e.target.value)}
            />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="currentAssets">
              Current Assets / Socho&apos;aa<RequiredMark />
            </Label>
            <Input
              id="currentAssets"
              name="currentAssets"
              type="number"
              min="0"
              step="0.01"
              required
              aria-required="true"
              value={currentAssets}
              onChange={(e) => onCurrentAssetsChange(e.target.value)}
            />
          </FieldGroup>
        </div>

        {/* Total Capital — read-only, auto-calculated */}
        <FieldGroup>
          <Label htmlFor="totalCapital">Total Capital (auto-calculated)</Label>
          <Input
            id="totalCapital"
            readOnly
            tabIndex={-1}
            aria-readonly="true"
            className="cursor-default bg-sand-100"
            value={
              totalCapital != null
                ? totalCapital.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                : ""
            }
            placeholder="Calculated from fixed + current assets"
          />
        </FieldGroup>
      </div>
    </Card>
  );
}
