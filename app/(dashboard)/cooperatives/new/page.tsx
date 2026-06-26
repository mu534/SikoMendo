import { requirePermission } from "@/lib/session";
import { createCooperative } from "@/features/cooperatives/actions";
import { CooperativeForm } from "@/features/cooperatives/cooperative-form";
import { generateNextCooperativeId } from "@/features/cooperatives/queries";

export default async function NewCooperativePage() {
  await requirePermission("MANAGE_COOPERATIVES");

  const cooperativeId = await generateNextCooperativeId();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">New cooperative</h2>
        <p className="mt-1 text-sm text-ink-900/60">
          Business ID <span className="font-medium text-ink-900">{cooperativeId}</span> has been
          pre-assigned and will be saved on submit.
        </p>
      </div>
      <CooperativeForm action={createCooperative} cooperativeId={cooperativeId} />
    </div>
  );
}
