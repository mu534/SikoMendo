"use client";

import { useState } from "react";
import { initials, cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

interface AvatarProps {
  /** Person's display name — used for alt text and initials fallback. */
  name?: string | null;
  /** Cloudinary (or any) image URL. Pass null/undefined to show initials. */
  imageUrl?: string | null;
  /** Size variant. Default: "md" (40 × 40 px). */
  size?: AvatarSize;
  className?: string;
  /** Version string/number appended as ?v=<version> to bust browser cache.
   *  Pass updatedAt timestamp so stale images are never shown after upload. */
  version?: string | number | Date | null;
  /** Kept for API compatibility — <img> is used rather than next/image per
   *  codebase convention for Cloudinary URLs (see ESLint disable below). */
  priority?: boolean;
}

// ── Size map ───────────────────────────────────────────────────────────────────

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: "h-8 w-8 text-[10px]",       // 32 × 32 px — dropdown menus
  sm: "h-9 w-9 text-xs",           // 36 × 36 px — tables, header user menu
  md: "h-10 w-10 text-sm",         // 40 × 40 px — sidebar, standard cards
  lg: "h-[88px] w-[88px] text-lg", // 88 × 88 px — employee detail header
  xl: "h-[120px] w-[120px] text-xl", // 120 × 120 px — My Profile hero
};

// ── Fallback icon (shown when name is empty) ───────────────────────────────────

function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn("opacity-60", className)}
    >
      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
    </svg>
  );
}

// ── Avatar component ───────────────────────────────────────────────────────────

export function Avatar({
  name,
  imageUrl,
  size = "md",
  className,
  version,
  priority: _priority, // accepted but unused — img tag has no priority concept
}: AvatarProps) {
  const [imgError, setImgError] = useState(false);

  const dimensions = SIZE_CLASSES[size];

  // Build the final src with optional cache-busting suffix
  let src: string | null = null;
  if (imageUrl && !imgError) {
    const v =
      version instanceof Date
        ? version.getTime()
        : version ?? null;
    src = v != null ? `${imageUrl}?v=${v}` : imageUrl;
  }

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote Cloudinary URLs, dimensions vary by usage
      <img
        src={src}
        alt={name ?? "User avatar"}
        onError={() => setImgError(true)}
        className={cn("rounded-full object-cover", dimensions, className)}
      />
    );
  }

  // Initials / icon fallback
  const initText = name ? initials(name) : "";

  return (
    <div
      role="img"
      aria-label={name ?? "User avatar"}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-display font-semibold text-brand-800",
        dimensions,
        className
      )}
    >
      {initText ? (
        initText
      ) : (
        <UserIcon className="h-1/2 w-1/2" />
      )}
    </div>
  );
}
