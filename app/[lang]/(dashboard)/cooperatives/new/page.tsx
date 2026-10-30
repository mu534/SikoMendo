import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { createCooperative } from "@/features/cooperatives/actions";
import { CooperativeForm } from "@/features/cooperatives/cooperative-form";
import { generateNextCooperativeId } from "@/features/cooperatives/queries";

export default async function NewCooperativePage() {
  await requirePermission("MANAGE_COOPERATIVES");

  const cooperativeId = await generateNextCooperativeId();

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/cooperatives"
        className="inline-flex items-center gap-1.5 text-sm text-ink-900/50 hover:text-ink-900 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to cooperatives
      </Link>

      {/* Page header */}
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">
          Register New Cooperative
        </h2>
        <p className="mt-1 text-sm text-ink-900/60">
          Business ID{" "}
          <span className="rounded bg-ink-900/6 px-1.5 py-0.5 font-mono text-xs font-medium text-ink-900">
            {cooperativeId}
          </span>{" "}
          has been pre-assigned and will be saved on submit. A legal certificate is required.
        </p>
      </div>

      <CooperativeForm action={createCooperative} cooperativeId={cooperativeId} />
    </div>
  );
}
