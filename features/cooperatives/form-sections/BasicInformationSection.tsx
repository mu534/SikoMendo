"use client";

import { Building2 } from "lucide-react";
import { Input, Label, Select, FieldGroup } from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import { RequiredMark, SectionHeader, toDateInputValue } from "../form-utils";
import type { CooperativeFormValues } from "../form-utils";

type Props = {
  cooperative?: CooperativeFormValues;
  cooperativeId?: string;
  onNameChange?: (v: string) => void;
};

/**
 * Section 1 of CooperativeForm: Basic Information.
 * Contains cooperative ID (read-only), name, type, registration number,
 * registration date, date joined union, and status.
 */
export function BasicInformationSection({ cooperative, cooperativeId, onNameChange }: Props) {
  return (
    <Card className="p-6">
      <SectionHeader icon={Building2} title="Basic Information" />
      <div className="space-y-5">

        {/* Row: Cooperative ID (read-only) + Cooperative Name* */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="cooperativeId_display">Cooperative ID</Label>
            <Input
              id="cooperativeId_display"
              readOnly
              tabIndex={-1}
              aria-readonly="true"
              value={cooperative?.cooperativeId ?? cooperativeId ?? "Auto-generated"}
              className="cursor-default bg-sand-100"
            />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="name">
              Cooperative Name<RequiredMark />
            </Label>
            <Input
              id="name"
              name="name"
              required
              aria-required="true"
              defaultValue={cooperative?.name ?? ""}
              placeholder="e.g. Bale Farmers Cooperative"
              onChange={onNameChange ? (e) => onNameChange(e.target.value) : undefined}
            />
          </FieldGroup>
        </div>

        {/* Row: Cooperative Type* + Registration Number* */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="cooperativeType">
              Cooperative Type<RequiredMark />
            </Label>
            <Select
              id="cooperativeType"
              name="cooperativeType"
              required
              aria-required="true"
              defaultValue={cooperative?.cooperativeType ?? ""}
            >
              <option value="">Select type…</option>
              <option value="Agricultural">Agricultural</option>
              <option value="Savings & Credit">Savings &amp; Credit</option>
              <option value="Consumer">Consumer</option>
              <option value="Marketing">Marketing</option>
              <option value="Service">Service</option>
              <option value="Multi-Purpose">Multi-Purpose</option>
            </Select>
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="registrationNumber">
              Registration Number<RequiredMark />
            </Label>
            <Input
              id="registrationNumber"
              name="registrationNumber"
              required
              aria-required="true"
              defaultValue={cooperative?.registrationNumber ?? ""}
            />
          </FieldGroup>
        </div>

        {/* Row: Registration Date* + Date Joined Union* */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="registrationDate">
              Registration Date<RequiredMark />
            </Label>
            <Input
              id="registrationDate"
              name="registrationDate"
              type="date"
              required
              aria-required="true"
              defaultValue={toDateInputValue(cooperative?.registrationDate)}
            />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="dateJoinedUnion">
              Date Joined Union<RequiredMark />
            </Label>
            <Input
              id="dateJoinedUnion"
              name="dateJoinedUnion"
              type="date"
              required
              aria-required="true"
              defaultValue={toDateInputValue(cooperative?.dateJoinedUnion)}
            />
          </FieldGroup>
        </div>

        {/* Row: Status* (half-width) */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="isActive">
              Status<RequiredMark />
            </Label>
            <Select
              id="isActive"
              name="isActive"
              required
              aria-required="true"
              defaultValue={cooperative?.isActive === false ? "false" : "true"}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
          </FieldGroup>
        </div>
      </div>
    </Card>
  );
}
