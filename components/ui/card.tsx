import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-2xl border border-ink-900/8 bg-white shadow-sm shadow-ink-900/[0.02]", className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-900/8 px-6 py-5">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-ink-900/60">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-ink-900/60">{label}</p>
        {icon && <div className="text-brand-600">{icon}</div>}
      </div>
      <p className="font-display mt-2 text-3xl font-semibold text-ink-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-900/50">{hint}</p>}
    </Card>
  );
}
