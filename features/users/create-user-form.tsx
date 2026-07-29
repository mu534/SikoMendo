"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createUserAccount, generateUserCredentials } from "./actions";
import { ROLES, roleLabel } from "@/lib/permissions";
import { Input, Label, Select, FieldGroup } from "@/components/ui/field";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function CreateUserForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createUserAccount, null);
  const [isGenerating, startGenerating] = useTransition();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"username" | "password" | null>(null);

  useEffect(() => {
    if (state?.success) {
      router.push(`/users/${state.data.id}`);
    }
  }, [state, router]);

  function handleGenerate() {
    if (!name.trim()) {
      setGenError("Enter the full name first so a username can be generated from it.");
      return;
    }
    setGenError(null);
    startGenerating(async () => {
      const result = await generateUserCredentials(name);
      if (result.success) {
        setUsername(result.data.username);
        setPassword(result.data.password);
        setShowPassword(true);
        setCopied(null);
      } else {
        setGenError(result.error.message);
      }
    });
  }

  async function copyToClipboard(value: string, field: "username" | "password") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(field);
      setTimeout(() => setCopied((current) => (current === field ? null : current)), 1500);
    } catch {
      // Clipboard API unavailable — the field's value is still visible and
      // can be copied manually, so there's nothing else to do here.
    }
  }

  return (
    <Card className="max-w-xl p-6">
      <form action={formAction} className="space-y-5">
        <FieldGroup>
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            name="name"
            required
            placeholder="e.g. Aster Tadesse"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </FieldGroup>

        <div className="rounded-lg border border-dashed border-brand-300 bg-brand-50/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-ink-900">Login credentials</p>
              <p className="text-xs text-ink-900/50">
                Generate a unique username and a strong temporary password automatically.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? "Generating…" : username ? "Regenerate" : "Generate"}
            </Button>
          </div>
          {genError && <p className="mt-2 text-sm text-red-600">{genError}</p>}
        </div>

        <FieldGroup>
          <Label htmlFor="username">Username</Label>
          <div className="flex gap-2">
            <Input
              id="username"
              name="username"
              required
              placeholder="e.g. aster.tadesse"
              autoComplete="off"
              pattern="[a-z0-9._\-]+"
              title="Lowercase letters, numbers, dots, hyphens, and underscores only"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            {username && (
              <Button
                type="button"
                variant="outline"
                onClick={() => copyToClipboard(username, "username")}
              >
                {copied === "username" ? "Copied" : "Copy"}
              </Button>
            )}
          </div>
          <p className="text-xs text-ink-900/50">
            Used to sign in. Lowercase letters, numbers, dots, hyphens, underscores only — or generate one above.
          </p>
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="password">Temporary password</Label>
          <div className="flex gap-2">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="button" variant="outline" onClick={() => setShowPassword((s) => !s)}>
              {showPassword ? "Hide" : "Show"}
            </Button>
            {password && (
              <Button
                type="button"
                variant="outline"
                onClick={() => copyToClipboard(password, "password")}
              >
                {copied === "password" ? "Copied" : "Copy"}
              </Button>
            )}
          </div>
          <p className="text-xs text-ink-900/50">
            Share this with the user — they can change it from their profile.
          </p>
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

        {state && !state.success && (
          <p className="text-sm text-red-600">{state.error.message}</p>
        )}

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
