"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input, Label, Textarea, FieldGroup } from "@/components/ui/field";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export type CooperativeFormValues = {
  name: string;
  description?: string | null;
  location?: string | null;
  contactPerson?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  isActive: boolean;
};

export function CooperativeForm({
  action,
  cooperative,
}: {
  action: (prevState: unknown, formData: FormData) => Promise<unknown>;
  cooperative?: CooperativeFormValues;
}) {
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- shared by create/update actions with slightly different bound signatures
  const [state, formAction, isPending] = useActionState(action as any, null);

  useEffect(() => {
    if (state && (state as { success: boolean }).success === true && !cooperative) {
      const id = (state as { data: { id: string } }).data.id;
      router.push(`/cooperatives/${id}`);
    }
  }, [state, router, cooperative]);

  const errorMessage = state && !(state as { success: boolean }).success ? (state as { error: { message: string } }).error.message : null;

  return (
    <Card className="max-w-2xl p-6">
      <form action={formAction} className="space-y-5">
        <FieldGroup>
          <Label htmlFor="name">Cooperative name</Label>
          <Input id="name" name="name" required defaultValue={cooperative?.name} />
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" rows={3} defaultValue={cooperative?.description ?? ""} />
        </FieldGroup>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="location">Location</Label>
            <Input id="location" name="location" placeholder="e.g. Robe, Bale Zone" defaultValue={cooperative?.location ?? ""} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="contactPerson">Contact person</Label>
            <Input id="contactPerson" name="contactPerson" defaultValue={cooperative?.contactPerson ?? ""} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="contactEmail">Contact email</Label>
            <Input id="contactEmail" name="contactEmail" type="email" defaultValue={cooperative?.contactEmail ?? ""} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="contactPhone">Contact phone</Label>
            <Input id="contactPhone" name="contactPhone" placeholder="+251 9XX XXX XXX" defaultValue={cooperative?.contactPhone ?? ""} />
          </FieldGroup>
        </div>

        <label className="flex items-center gap-2.5 text-sm font-medium text-ink-900">
          <input type="checkbox" name="isActive" defaultChecked={cooperative?.isActive ?? true} className="h-4 w-4 rounded border-ink-900/25 text-brand-700 focus:ring-brand-500" />
          Active
        </label>

        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

        <div className="flex items-center gap-3 border-t border-ink-900/8 pt-5">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : cooperative ? "Save changes" : "Create cooperative"}
          </Button>
          <ButtonLink href="/cooperatives" variant="ghost">
            Cancel
          </ButtonLink>
        </div>
      </form>
    </Card>
  );
}
