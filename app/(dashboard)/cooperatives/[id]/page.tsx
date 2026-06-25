import { notFound } from "next/navigation";
import Link from "next/link";
import { Users } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getCooperativeById } from "@/features/cooperatives/queries";
import { updateCooperative } from "@/features/cooperatives/actions";
import { CooperativeForm } from "@/features/cooperatives/cooperative-form";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

type AssignedEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  position: string | null;
  profileImageUrl: string | null;
};

export default async function CooperativeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("VIEW_COOPERATIVES");
  const { id } = await params;

  const cooperative = await getCooperativeById(id);
  if (!cooperative) notFound();

  const canManage = can(session.user.role, "MANAGE_COOPERATIVES");

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-xl font-semibold text-ink-900">{cooperative.name}</h2>
          <Badge tone="brand">{cooperative.cooperativeId}</Badge>
          {cooperative.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Inactive</Badge>}
        </div>
        {cooperative.location && <p className="mt-1 text-sm text-ink-900/60">{cooperative.location}</p>}
      </div>

      {canManage ? (
        <CooperativeForm action={updateCooperative.bind(null, cooperative.id)} cooperative={cooperative} />
      ) : (
        <Card className="max-w-2xl p-6">
          <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <ReadField label="Description" value={cooperative.description} className="sm:col-span-2" />
            <ReadField label="Contact person" value={cooperative.contactPerson} />
            <ReadField label="Contact email" value={cooperative.contactEmail} />
            <ReadField label="Contact phone" value={cooperative.contactPhone} />
          </dl>
        </Card>
      )}

      <Card>
        <CardHeader title="Assigned employees" description={`${cooperative._count.employees} employee${cooperative._count.employees === 1 ? "" : "s"} at this cooperative.`} />
        {cooperative.employees.length === 0 ? (
          <EmptyState icon={<Users className="h-8 w-8" />} title="No employees assigned yet" />
        ) : (
          <ul className="divide-y divide-ink-900/6">
            {cooperative.employees.map((employee: AssignedEmployee) => (
              <li key={employee.id}>
                <Link href={`/employees/${employee.id}`} className="flex items-center gap-3 px-6 py-3.5 hover:bg-sand-100/70">
                  <Avatar name={`${employee.firstName} ${employee.lastName}`} imageUrl={employee.profileImageUrl} size="sm" />
                  <div>
                    <p className="text-sm font-medium text-ink-900">
                      {employee.firstName} {employee.lastName}
                    </p>
                    <p className="text-xs text-ink-900/50">
                      {employee.employeeId} {employee.position ? `· ${employee.position}` : ""}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ReadField({ label, value, className }: { label: string; value?: string | null; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-900/45">{label}</dt>
      <dd className="mt-1 text-sm text-ink-900/80">{value || "—"}</dd>
    </div>
  );
}
