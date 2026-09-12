"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, Eye, EyeOff } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldGroup, FieldError } from "@/components/ui/field";

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [username, setUsername]       = useState("");
  const [password, setPassword]       = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Field-level validation errors
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  // Server / auth-level error
  const [formError, setFormError]     = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Reset errors
    setUsernameError(null);
    setPasswordError(null);
    setFormError(null);

    // Client-side field validation
    let valid = true;
    if (!username.trim()) {
      setUsernameError("Enter your username");
      valid = false;
    }
    if (!password) {
      setPasswordError("Enter your password");
      valid = false;
    }
    if (!valid) return;

    setIsSubmitting(true);
    try {
      const { error } = await (
        authClient.signIn as {
          username: (opts: {
            username: string;
            password: string;
          }) => Promise<{ error: { message?: string } | null }>;
        }
      ).username({ username: username.trim(), password });

      if (error) {
        setFormError(error.message ?? "Invalid username or password.");
        return;
      }

      const redirectTo = searchParams.get("redirectTo") || "/dashboard";
      router.push(redirectTo);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
          <LogIn className="h-5 w-5" />
        </div>
        <h1 className="font-display mt-5 text-2xl font-semibold text-ink-900">Welcome back</h1>
        <p className="mt-1.5 text-sm text-ink-900/60">
          Sign in with the username and password your Administrator created for you.
        </p>
      </div>

      <form onSubmit={handleSubmit} method="post" className="space-y-5" noValidate>
        <FieldGroup>
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            placeholder="e.g. emp-0001"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <FieldError>{usernameError}</FieldError>
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className="pr-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-900/40 hover:text-ink-900"
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          <FieldError>{passwordError}</FieldError>
        </FieldGroup>

        {formError && (
          <p role="alert" className="text-sm text-red-600">
            {formError}
          </p>
        )}

        <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="text-center text-xs text-ink-900/40">
        Forgot your password? Contact your HR Officer or Administrator.
      </p>
    </div>
  );
}
