"use client";

import { useActionState } from "react";
import { updateUserAccount } from "@/features/users/actions";
import { ROLES, roleLabel } from "@/lib/permissions";
import { Input, Label, Select, FieldGroup } from "@/components/ui/field";
import { Button, ButtonLink } from "@/components/ui/button";
import { PhotoInput } from "@/features/employees/photo-input";

export function EditUserForm({
  user,
}: {
  user: { id: string; name: string; username: string | null; role: string; image: string | null };
}) {
  const action = updateUserAccount.bind(null, user.id);
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-5">
      <PhotoInput name="photo" currentName={user.name} currentUrl={user.image} />

      <FieldGroup>
        <Label htmlFor="name">Full name</Label>
        <Input id="name" name="name" required defaultValue={user.name} />
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          name="username"
          required
          defaultValue={user.username ?? ""}
          readOnly
          className="cursor-default bg-sand-100 text-ink-900/60"
          tabIndex={-1}
        />
        <p className="text-xs text-ink-900/50">
          Username is permanent and cannot be changed — it matches the employee&apos;s ID.
        </p>
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="role">System Role</Label>
        <Select id="role" name="role" required defaultValue={user.role}>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {roleLabel(role)}
            </option>
          ))}
        </Select>
        <p className="text-xs text-ink-900/50">
          Controls HRMIS access. Independent of job title — assign{" "}
          <span className="font-medium">General Manager</span> only to the
          organisation&apos;s central manager, not to department-level managers.
        </p>
      </FieldGroup>

      {state && !state.success && (
        <p className="text-sm text-red-600">{state.error.message}</p>
      )}
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
