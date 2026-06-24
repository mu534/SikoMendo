import { Search } from "lucide-react";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

/**
 * A plain GET form: works without client-side JavaScript, which keeps list
 * pages simple server components. Submitting re-requests the page with the
 * new query string, and the server re-runs the filtered/paginated query.
 */
export function Toolbar({
  basePath,
  searchPlaceholder,
  searchDefault,
  children,
}: {
  basePath: string;
  searchPlaceholder: string;
  searchDefault?: string;
  children?: React.ReactNode;
}) {
  return (
    <form action={basePath} method="get" className="flex flex-wrap items-end gap-3 border-b border-ink-900/8 px-6 py-4">
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-900/35" />
        <Input name="q" placeholder={searchPlaceholder} defaultValue={searchDefault} className="pl-9" />
      </div>
      {children}
      <Button type="submit" variant="secondary">
        Apply filters
      </Button>
    </form>
  );
}
