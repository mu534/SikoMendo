/**
 * loading.tsx — dashboard route segment loading state.
 *
 * Next.js shows this component instantly on every navigation while the
 * server component (page.tsx) is fetching data. Without this file the user
 * sees a frozen screen until every query completes.
 *
 * The skeleton matches the general card+content layout used across the
 * dashboard so the transition feels smooth.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-hidden="true">
      {/* Page header skeleton */}
      <div className="space-y-2">
        <div className="h-6 w-48 rounded-lg bg-ink-900/8" />
        <div className="h-4 w-72 rounded-lg bg-ink-900/5" />
      </div>

      {/* Stat cards row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-ink-900/8 bg-white p-5 shadow-sm">
            <div className="h-3 w-20 rounded bg-ink-900/8 mb-3" />
            <div className="h-8 w-14 rounded bg-ink-900/10" />
          </div>
        ))}
      </div>

      {/* Main content card */}
      <div className="rounded-2xl border border-ink-900/8 bg-white shadow-sm overflow-hidden">
        {/* Table header row */}
        <div className="flex gap-3 border-b border-ink-900/8 px-4 py-3">
          <div className="h-8 flex-1 rounded-lg bg-ink-900/6" />
          <div className="h-8 w-32 rounded-lg bg-ink-900/6" />
          <div className="h-8 w-24 rounded-lg bg-ink-900/6" />
        </div>

        {/* Table rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-ink-900/5 px-6 py-4 last:border-0"
          >
            {/* Avatar */}
            <div className="h-9 w-9 shrink-0 rounded-full bg-ink-900/8" />
            {/* Name + sub */}
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-32 rounded bg-ink-900/8" />
              <div className="h-3 w-20 rounded bg-ink-900/5" />
            </div>
            {/* Badge */}
            <div className="h-5 w-16 rounded-full bg-ink-900/6" />
          </div>
        ))}
      </div>
    </div>
  );
}
