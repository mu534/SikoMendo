"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createUserAccount } from "./actions";
import { ROLES, roleLabel } from "@/lib/permissions";
import { Input, Label, Select, FieldGroup } from "@/components/ui/field";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function CreateUserForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createUserAccount, null);

  useEffect(() => {
    if (state?.success) {
      router.push(`/users/${state.data.id}`);
    }
  }, [state, router]);

  return (
    <Card className="max-w-xl p-6">
      <form action={formAction} className="space-y-5">
        <FieldGroup>
          <Label htmlFor="name">Full name</Label>
          <Input id="name" name="name" required placeholder="e.g. Aster Tadesse" />
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="email">Email address</Label>
          <Input id="email" name="email" type="email" required placeholder="name@sikomendo.org" />
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="password">Temporary password</Label>
          <Input id="password" name="password" type="password" required minLength={8} />
          <p className="text-xs text-ink-900/50">Share this with the user — they can change it from their profile.</p>
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="role">Role</Label>
          <Select id="role" name="role" required defaultValue="EMPLOYEE">
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {roleLabel(role)}
              </option>
            ))}
          </Select>
        </FieldGroup>

        {state && !state.success && <p className="text-sm text-red-600">{state.error.message}</p>}

        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating…" : "Create user"}
          </Button>
          <ButtonLink href="/users" variant="ghost">
            Cancel
          </ButtonLink>
        </div>
      </form>
    </Card>
  );
}
