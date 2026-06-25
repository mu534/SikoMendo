import { requirePermission } from "@/lib/session";
import { createCooperative } from "@/features/cooperatives/actions";
import { CooperativeForm } from "@/features/cooperatives/cooperative-form";

export default async function NewCooperativePage() {
  await requirePermission("MANAGE_COOPERATIVES");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">New cooperative</h2>
        <p className="mt-1 text-sm text-ink-900/60">A business ID (e.g. COOP-003) is assigned automatically.</p>
      </div>
      <CooperativeForm action={createCooperative} />
    </div>
  );
}
