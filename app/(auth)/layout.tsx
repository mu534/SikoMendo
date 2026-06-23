import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "Sign in | Siko Mendo HRMIS",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-100 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl grid-cols-1 overflow-hidden rounded-[2rem] bg-white shadow-xl shadow-zinc-900/10 lg:grid-cols-[1.2fr_1fr]">
        <div className="relative overflow-hidden bg-emerald-950 px-8 py-12 text-white sm:px-12 sm:py-16 lg:px-16 lg:py-20">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.35),_transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.05),transparent)]" />
          <div className="relative flex h-full flex-col justify-between gap-8">
            <div>
              <div className="flex items-center gap-3 rounded-full bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.24em] text-emerald-100 shadow-inner shadow-black/10">
                <span className="font-semibold">Siko Mendo Union</span>
              </div>
              <div className="mt-10 space-y-6">
                <div>
                  <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                    Human Resource Information
                    <br /> Management System
                  </h1>
                  <p className="mt-6 max-w-md text-sm leading-6 text-emerald-200 sm:text-base">
                    A unified platform for managing employees, cooperatives, attendance, and reports efficiently and securely.
                  </p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/10 backdrop-blur">
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-100">Welcome to Siko Mendo</p>
                  <p className="mt-3 text-sm leading-6 text-emerald-200">
                    Sign in to access your dashboard, manage users, and review attendance records.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-auto text-sm text-emerald-200">
              <p>© 2024 Siko Mendo Union. All rights reserved.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center bg-white px-8 py-10 sm:px-12 lg:px-16">
          <div className="w-full max-w-md">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
