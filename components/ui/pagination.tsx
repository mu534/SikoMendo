import Link from "next/link";
import { cn } from "@/lib/utils";

function buildHref(basePath: string, params: Record<string, string | undefined>, page: number) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  query.set("page", String(page));
  return `${basePath}?${query.toString()}`;
}

export function Pagination({
  basePath,
  params,
  page,
  totalPages,
  totalItems,
  pageSize,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
}) {
  if (totalItems === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-900/8 px-6 py-4">
      <p className="text-sm text-ink-900/60">
        Showing <span className="font-medium text-ink-900">{start}</span>–
        <span className="font-medium text-ink-900">{end}</span> of{" "}
        <span className="font-medium text-ink-900">{totalItems}</span>
      </p>
      <div className="flex items-center gap-1.5">
        <PageLink basePath={basePath} params={params} page={page - 1} disabled={page <= 1}>
          Previous
        </PageLink>
        <span className="px-2 text-sm text-ink-900/60">
          Page {page} of {totalPages}
        </span>
        <PageLink basePath={basePath} params={params} page={page + 1} disabled={page >= totalPages}>
          Next
        </PageLink>
      </div>
    </div>
  );
}

function PageLink({
  basePath,
  params,
  page,
  disabled,
  children,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const className = cn(
    "rounded-lg border px-3 py-1.5 text-sm font-medium transition",
    disabled
      ? "cursor-not-allowed border-ink-900/8 text-ink-900/30"
      : "border-ink-900/15 text-ink-900 hover:bg-sand-100"
  );

  if (disabled) {
    return <span className={className}>{children}</span>;
  }

  return (
    <Link href={buildHref(basePath, params, page)} className={className}>
      {children}
    </Link>
  );
}
