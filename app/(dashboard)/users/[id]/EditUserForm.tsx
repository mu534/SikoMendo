"use client";

import { useActionState } from "react";
import { updateUserAccount } from "@/features/users/actions";
import { ROLES, roleLabel } from "@/lib/permissions";
import { Input, Label, Select, FieldGroup } from "@/components/ui/field";
import { Button, ButtonLink } from "@/components/ui/button";

export function EditUserForm({
  user,
}: {
  user: { id: string; name: string; email: string; role: string };
}) {
  const action = updateUserAccount.bind(null, user.id);
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-5">
      <FieldGroup>
        <Label htmlFor="name">Full name</Label>
        <Input id="name" name="name" required defaultValue={user.name} />
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="email">Email address</Label>
        <Input id="email" name="email" type="email" required defaultValue={user.email} />
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="role">Role</Label>
        <Select id="role" name="role" required defaultValue={user.role}>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {roleLabel(role)}
            </option>
          ))}
        </Select>
      </FieldGroup>

      {state && !state.success && <p className="text-sm text-red-600">{state.error.message}</p>}
      {state?.success && <p className="text-sm text-emerald-600">Saved.</p>}

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save changes"}
        </Button>
        <ButtonLink href="/users" variant="ghost">
          Back to users
        </ButtonLink>
      </div>
    </form>
  );
}
