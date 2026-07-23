"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LogIn } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldGroup, FieldError } from "@/components/ui/field";

const signInSchema = z.object({
  username: z.string().min(1, "Enter your username"),
  password: z.string().min(1, "Enter your password"),
});

type SignInValues = z.infer<typeof signInSchema>;

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({ resolver: zodResolver(signInSchema) });

  async function onSubmit(values: SignInValues) {
    setFormError(null);

    // Use the username plugin's sign-in endpoint
    const { error } = await (authClient.signIn as { username: (opts: { username: string; password: string }) => Promise<{ error: { message?: string } | null }> }).username({
      username: values.username,
      password: values.password,
    });

    if (error) {
      setFormError(error.message ?? "Invalid username or password.");
      return;
    }

    const redirectTo = searchParams.get("redirectTo") || "/dashboard";
    router.push(redirectTo);
    router.refresh();
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

      <form onSubmit={handleSubmit(onSubmit)} method="post" className="space-y-5">
        <FieldGroup>
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            type="text"
            autoComplete="username"
            placeholder="e.g. aster.tadesse"
            {...register("username")}
          />
          <FieldError>{errors.username?.message}</FieldError>
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register("password")}
          />
          <FieldError>{errors.password?.message}</FieldError>
        </FieldGroup>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

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
