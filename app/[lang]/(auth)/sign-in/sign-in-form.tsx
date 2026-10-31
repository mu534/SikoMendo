"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { LogIn, Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldGroup, FieldError } from "@/components/ui/field";

// Maps raw better-auth error messages to safe translation sub-keys
function mapAuthError(message: string | undefined): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("banned") || m.includes("suspended")) return "accountBanned";
  if (m.includes("too many") || m.includes("rate limit")) return "tooManyRequests";
  // Default — covers "invalid email or password", "user not found", etc.
  return "invalidCredentials";
}

export function SignInForm() {
  const t = useTranslations("auth.signIn");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [username, setUsername]         = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError]         = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setUsernameError(null);
    setPasswordError(null);
    setFormError(null);

    let valid = true;
    if (!username.trim()) {
      setUsernameError(t("errors.usernameRequired"));
      valid = false;
    }
    if (!password) {
      setPasswordError(t("errors.passwordRequired"));
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
        const errKey = mapAuthError(error.message);
        setFormError(t(`errors.${errKey}`));
        return;
      }

      // Only follow a redirectTo that is a safe relative path
      const raw = searchParams.get("redirectTo") ?? "";
      const redirectTo =
        raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";
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
        <h1 className="font-display mt-5 text-2xl font-semibold text-ink-900">
          {t("title")}
        </h1>
        <p className="mt-1.5 text-sm text-ink-900/60">{t("subtitle")}</p>
      </div>

      <form onSubmit={handleSubmit} method="post" className="space-y-5" noValidate>
        <FieldGroup>
          <Label htmlFor="username">{t("usernameLabel")}</Label>
          <Input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            placeholder={t("usernamePlaceholder")}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <FieldError>{usernameError}</FieldError>
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="password">{t("passwordLabel")}</Label>
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
              aria-label={showPassword ? t("hidePassword") : t("showPassword")}
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
          {isSubmitting ? t("submitting") : t("submit")}
        </Button>
      </form>

      <p className="text-center text-xs text-ink-900/40">{t("forgotPassword")}</p>
    </div>
  );
}
