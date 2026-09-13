"use client";

import { Users } from "lucide-react";
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

/**
 * Section 4 of CooperativeForm: Membership Information.
 * State is controlled by the parent form (required for cross-field validation).
 */
export function MembershipSection({
  totalMembers,
  maleMembers,
  femaleMembers,
  memberMismatch,
  onTotalChange,
  onMaleChange,
  onFemaleChange,
}: Props) {
  return (
    <Card className="p-6">
      <SectionHeader icon={Users} title="Membership Information" />
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="totalMembers">
              Total Members<RequiredMark />
            </Label>
            <Input
              id="totalMembers"
              name="totalMembers"
              type="number"
              min="0"
              step="1"
              required
              aria-required="true"
              value={totalMembers}
              onChange={(e) => onTotalChange(e.target.value)}
            />
            {memberMismatch && (
              <FieldError>Male + Female members must equal Total members</FieldError>
            )}
          </FieldGroup>

          {/* spacer on desktop */}
          <div className="hidden sm:block" aria-hidden="true" />

          <FieldGroup>
            <Label htmlFor="maleMembers">
              Male Members<RequiredMark />
            </Label>
            <Input
              id="maleMembers"
              name="maleMembers"
              type="number"
              min="0"
              step="1"
              required
              aria-required="true"
              value={maleMembers}
              onChange={(e) => onMaleChange(e.target.value)}
            />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="femaleMembers">
              Female Members<RequiredMark />
            </Label>
            <Input
              id="femaleMembers"
              name="femaleMembers"
              type="number"
              min="0"
              step="1"
              required
              aria-required="true"
              value={femaleMembers}
              onChange={(e) => onFemaleChange(e.target.value)}
            />
          </FieldGroup>
        </div>
      </div>
    </Card>
  );
}
