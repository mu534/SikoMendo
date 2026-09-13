"use client";

import { Building2 } from "lucide-react";
import { Input, Label, Textarea, FieldGroup } from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "../form-utils";
import type { CooperativeFormValues } from "../form-utils";

type Props = {
  cooperative?: CooperativeFormValues;
};

/**
 * Section 6 of CooperativeForm: Contact & Additional Information.
 * All fields are optional — no required marks.
 */
export function ContactSection({ cooperative }: Props) {
  return (
    <Card className="p-6">
      <SectionHeader icon={Building2} title="Contact &amp; Additional Information" />
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="contactPerson">Contact Person</Label>
            <Input
              id="contactPerson"
              name="contactPerson"
              defaultValue={cooperative?.contactPerson ?? ""}
            />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="contactEmail">Contact Email</Label>
            <Input
              id="contactEmail"
              name="contactEmail"
              type="email"
              defaultValue={cooperative?.contactEmail ?? ""}
            />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="contactPhone">Contact Phone</Label>
            <Input
              id="contactPhone"
              name="contactPhone"
              placeholder="+251 9XX XXX XXX"
              defaultValue={cooperative?.contactPhone ?? ""}
            />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              name="location"
              placeholder="e.g. Robe, Bale Zone"
              defaultValue={cooperative?.location ?? ""}
            />
          </FieldGroup>
        </div>

        <FieldGroup>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={cooperative?.description ?? ""}
          />
        </FieldGroup>
      </div>
    </Card>
  );
}
