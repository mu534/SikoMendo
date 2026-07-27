import { cn } from "@/lib/utils";

const TONES = {
  neutral: "bg-ink-900/5 text-ink-700",
  brand: "bg-brand-50 text-brand-800",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-gold-400/15 text-gold-600",
  danger: "bg-red-50 text-red-700",
} as const;

export type BadgeTone = keyof typeof TONES;

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}