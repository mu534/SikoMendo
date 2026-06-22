import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <main className="w-full max-w-3xl rounded-lg border border-zinc-200 bg-white p-12">
        <h1 className="text-3xl font-semibold text-zinc-900">Siko Mendo HRMIS</h1>
        <p className="mt-2 text-sm text-zinc-600">Human Resource Management Information System for Siko Mendo Union.</p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/sign-in"
            className="inline-flex items-center justify-center rounded-lg bg-sky-950 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
          >
            Sign in
          </Link>

          <Link
            href="/users"
            className="inline-flex items-center justify-center rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            Browse Users
          </Link>
        </div>

        <p className="mt-6 text-xs text-zinc-500">Developed with Next.js + Prisma. Build date: 2026-06-22</p>
      </main>
    </div>
  );
}
