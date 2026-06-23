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
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="flex items-center gap-3 text-emerald-950">
          <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-emerald-100 text-2xl">
            <span>👤</span>
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-emerald-600">Welcome Back!</p>
            <h1 className="text-3xl font-semibold text-zinc-950">Login to your account</h1>
          </div>
        </div>
        <p className="max-w-md text-sm text-zinc-600">
          Please login to access your account.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-medium text-zinc-900">
            Username
          </label>
          <input
            id="email"
            type="email"
            placeholder="Enter your username"
            className="w-full rounded-3xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            {...register("email")}
          />
          {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium text-zinc-900">
            Password
          </label>
          <input
            id="password"
            type="password"
            placeholder="Enter your password"
            className="w-full rounded-3xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            {...register("password")}
          />
          {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
        </div>

        <div className="flex items-center justify-between text-sm text-zinc-600">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500" />
            Remember me
          </label>
          <a href="#" className="text-emerald-600 hover:text-emerald-700">
            Forgot Password?
          </a>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex w-full items-center justify-center rounded-3xl bg-emerald-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Logging in…" : "Login"}
        </button>
      </form>

      <div className="border-t border-zinc-200 pt-5 text-center text-xs text-zinc-500">
        © 2024 Siko Mendo Union. All rights reserved.
      </div>
    </div>
  );
}
