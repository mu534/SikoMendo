import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "Sign in | Siko Mendo HRMIS",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full bg-zinc-50 antialiased">
      <body className="min-h-screen flex items-center justify-center bg-zinc-50 px-4 py-10">
        <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm shadow-zinc-950/5">
          {children}
        </div>
      </body>
    </html>
  );
}
