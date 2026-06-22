"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const signInSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type SignInFormValues = z.infer<typeof signInSchema>;

export default function SignInPage() {
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
  });

  async function onSubmit(values: SignInFormValues) {
    setError(null);

    const response = await fetch("/api/auth/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      const json = await response.json().catch(() => null);
      setError(json?.message || "Unable to sign in. Please try again.");
      return;
    }

    window.location.href = "/";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-zinc-950">Sign in</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Sign in with your email and password to continue.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-zinc-900">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            {...register("email")}
          />
          {errors.email && <p className="mt-2 text-sm text-red-600">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-zinc-900">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            {...register("password")}
          />
          {errors.password && <p className="mt-2 text-sm text-red-600">{errors.password.message}</p>}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex w-full items-center justify-center rounded-2xl bg-sky-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
