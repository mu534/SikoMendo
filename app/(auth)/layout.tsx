import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sand-100 px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid w-full max-w-6xl grid-cols-1 overflow-hidden rounded-[2rem] bg-white shadow-xl shadow-ink-900/10 lg:grid-cols-[1.2fr_1fr]">
        <div className="relative hidden overflow-hidden bg-brand-900 px-12 py-16 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_45%)]" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-brand-100">
              Siko Mendo Union
            </div>
            <h1 className="font-display mt-10 text-4xl font-semibold leading-tight tracking-tight">
              Human Resource Information
              <br /> Management System
            </h1>
            <p className="mt-6 max-w-md text-sm leading-6 text-brand-100/80">
              One place to manage members, cooperatives, attendance, and reports across Siko Mendo Union — Bale
              Robe, Ethiopia.
            </p>
          </div>
          <p className="relative text-sm text-brand-100/60">© {new Date().getFullYear()} Siko Mendo Union</p>
        </div>

        <div className="flex items-center justify-center px-6 py-12 sm:px-10 lg:px-14">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}
