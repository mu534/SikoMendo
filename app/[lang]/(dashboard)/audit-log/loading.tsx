/**
 * loading.tsx — audit log route loading state.
 *
 * The audit log table can be large. This skeleton gives instant feedback
 * while the server fetches and paginates the rows.
 */
export default function AuditLogLoading() {
  return (
    <div className="space-y-5 animate-pulse" aria-hidden="true">
      {/* Page header */}
      <div className="space-y-2">
        <div className="h-6 w-36 rounded-lg bg-ink-900/8" />
        <div className="h-4 w-64 rounded-lg bg-ink-900/5" />
      </div>

      <div className="rounded-2xl border border-ink-900/8 bg-white shadow-sm overflow-hidden">
        {/* Filter bar */}
        <div className="flex flex-wrap gap-2 border-b border-ink-900/8 px-4 py-3">
          <div className="h-8 flex-1 min-w-[180px] rounded-lg bg-ink-900/6" />
          <div className="h-8 w-36 rounded-lg bg-ink-900/6" />
          <div className="h-8 w-32 rounded-lg bg-ink-900/6" />
          <div className="h-8 w-32 rounded-lg bg-ink-900/6" />
          <div className="h-8 w-28 rounded-lg bg-ink-900/6" />
          <div className="h-8 w-28 rounded-lg bg-ink-900/6" />
          <div className="h-8 w-20 rounded-lg bg-ink-900/8" />
        </div>

        {/* Table header */}
        <div className="flex gap-6 border-b border-ink-900/6 px-6 py-3">
          {["w-28", "w-24", "w-20", "w-32", "w-40"].map((w, i) => (
            <div key={i} className={`h-3 ${w} rounded bg-ink-900/8`} />
          ))}
        </div>

        {/* Table rows */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-6 border-b border-ink-900/5 px-6 py-4 last:border-0"
          >
            {/* Timestamp */}
            <div className="h-3.5 w-28 rounded bg-ink-900/6 shrink-0" />
            {/* User */}
            <div className="space-y-1.5 w-28 shrink-0">
              <div className="h-3.5 w-24 rounded bg-ink-900/8" />
              <div className="h-3 w-16 rounded bg-ink-900/5" />
            </div>
            {/* Action badge */}
            <div className="h-5 w-16 rounded-full bg-ink-900/8 shrink-0" />
            {/* Module */}
            <div className="space-y-1.5 w-32 shrink-0">
              <div className="h-3.5 w-24 rounded bg-ink-900/8" />
              <div className="h-3 w-20 rounded bg-ink-900/5" />
            </div>
            {/* Details */}
            <div className="h-3.5 flex-1 rounded bg-ink-900/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
