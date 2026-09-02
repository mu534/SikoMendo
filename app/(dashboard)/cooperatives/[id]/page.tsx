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
import { formatDateWithEthiopian } from "@/lib/ethiopian-calendar";

type AssignedEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  position: { name: string };
  profileImageUrl: string | null;
};

export default async function CooperativeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission("VIEW_COOPERATIVES");
  const { id } = await params;

  const cooperative = await getCooperativeById(id);
  if (!cooperative) notFound();

  const canManage = can(session.user.role, "MANAGE_COOPERATIVES");

  // Convert Prisma Decimal fields → plain numbers, Date → ISO strings,
  // null required strings → empty string for the client form
  const cooperativeFormValues = {
    cooperativeId: cooperative.cooperativeId,
    name: cooperative.name,
    cooperativeType: cooperative.cooperativeType ?? "",
    registrationNumber: cooperative.registrationNumber ?? "",
    registrationDate: cooperative.registrationDate ? cooperative.registrationDate.toISOString() : "",
    dateJoinedUnion: cooperative.dateJoinedUnion ? cooperative.dateJoinedUnion.toISOString() : "",
    isActive: cooperative.isActive,
    district: cooperative.district ?? "",
    kebele: cooperative.kebele ?? "",
    businessType: cooperative.businessType ?? "",
    registrationFee: cooperative.registrationFee != null ? Number(cooperative.registrationFee) : 0,
    numberOfShares: cooperative.numberOfShares ?? 0,
    pricePerShare: cooperative.pricePerShare != null ? Number(cooperative.pricePerShare) : 0,
    totalMembers: cooperative.totalMembers ?? 0,
    maleMembers: cooperative.maleMembers ?? 0,
    femaleMembers: cooperative.femaleMembers ?? 0,
    fixedAssets: cooperative.fixedAssets != null ? Number(cooperative.fixedAssets) : 0,
    currentAssets: cooperative.currentAssets != null ? Number(cooperative.currentAssets) : 0,
    description: cooperative.description,
    location: cooperative.location,
    contactPerson: cooperative.contactPerson,
    contactEmail: cooperative.contactEmail,
    contactPhone: cooperative.contactPhone,
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-xl font-semibold text-ink-900">{cooperative.name}</h2>
          <Badge tone="brand">{cooperative.cooperativeId}</Badge>
          {cooperative.isActive ? (
            <Badge tone="success">Active</Badge>
          ) : (
            <Badge tone="neutral">Inactive</Badge>
          )}
        </div>
        {cooperative.location && (
          <p className="mt-1 text-sm text-ink-900/60">{cooperative.location}</p>
        )}
      </div>

      {canManage ? (
        <CooperativeForm
          action={updateCooperative.bind(null, cooperative.id)}
          cooperative={cooperativeFormValues}
        />
      ) : (
        <Card className="max-w-3xl p-6">
          <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <ReadField label="Cooperative ID" value={cooperative.cooperativeId} />
            <ReadField label="Cooperative Type" value={cooperative.cooperativeType} />
            <ReadField label="Registration Number" value={cooperative.registrationNumber} />
            <ReadField
              label="Registration Date"
              value={formatDateWithEthiopian(cooperative.registrationDate)}
            />
            <ReadField
              label="Date Joined Union"
              value={formatDateWithEthiopian(cooperative.dateJoinedUnion)}
            />
            <ReadField label="Status" value={cooperative.isActive ? "Active" : "Inactive"} />
            <ReadField label="District / Aanaa" value={cooperative.district} />
            <ReadField label="Kebele / Ganda" value={cooperative.kebele} />
            <ReadField label="Location" value={cooperative.location} />
            <ReadField label="Business Type" value={cooperative.businessType} />
            <ReadField
              label="Registration Fee"
              value={cooperative.registrationFee != null
                ? Number(cooperative.registrationFee).toLocaleString()
                : null}
            />
            <ReadField
              label="Number of Shares"
              value={cooperative.numberOfShares != null
                ? cooperative.numberOfShares.toLocaleString()
                : null}
            />
            <ReadField
              label="Price Per Share"
              value={cooperative.pricePerShare != null
                ? Number(cooperative.pricePerShare).toLocaleString()
                : null}
            />
            <ReadField
              label="Total Share Value"
              value={cooperative.numberOfShares != null && cooperative.pricePerShare != null
                ? (cooperative.numberOfShares * Number(cooperative.pricePerShare)).toLocaleString(
                    "en-US",
                    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                  )
                : null}
            />
            <ReadField
              label="Total Members"
              value={cooperative.totalMembers != null
                ? cooperative.totalMembers.toLocaleString()
                : null}
            />
            <ReadField
              label="Male Members"
              value={cooperative.maleMembers != null
                ? cooperative.maleMembers.toLocaleString()
                : null}
            />
            <ReadField
              label="Female Members"
              value={cooperative.femaleMembers != null
                ? cooperative.femaleMembers.toLocaleString()
                : null}
            />
            <ReadField
              label="Fixed Assets"
              value={cooperative.fixedAssets != null
                ? Number(cooperative.fixedAssets).toLocaleString()
                : null}
            />
            <ReadField
              label="Current Assets"
              value={cooperative.currentAssets != null
                ? Number(cooperative.currentAssets).toLocaleString()
                : null}
            />
            <ReadField
              label="Total Capital"
              value={cooperative.fixedAssets != null && cooperative.currentAssets != null
                ? (Number(cooperative.fixedAssets) + Number(cooperative.currentAssets)).toLocaleString(
                    "en-US",
                    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                  )
                : null}
            />
            <ReadField label="Contact Person" value={cooperative.contactPerson} />
            <ReadField label="Contact Email" value={cooperative.contactEmail} />
            <ReadField label="Contact Phone" value={cooperative.contactPhone} />
            <ReadField label="Description" value={cooperative.description} className="sm:col-span-2" />
          </dl>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Assigned employees"
          description={`${cooperative._count.employees} employee${
            cooperative._count.employees === 1 ? "" : "s"
          } at this cooperative.`}
        />
        {cooperative.employees.length === 0 ? (
          <EmptyState icon={<Users className="h-8 w-8" />} title="No employees assigned yet" />
        ) : (
          <ul className="divide-y divide-ink-900/6">
            {cooperative.employees.map((employee: AssignedEmployee) => (
              <li key={employee.id}>
                <Link
                  href={`/employees/${employee.id}`}
                  className="flex items-center gap-3 px-6 py-3.5 hover:bg-sand-100/70"
                >
                  <Avatar
                    name={`${employee.firstName} ${employee.lastName}`}
                    imageUrl={employee.profileImageUrl}
                    size="sm"
                  />
                  <div>
                    <p className="text-sm font-medium text-ink-900">
                      {employee.firstName} {employee.lastName}
                    </p>
                    <p className="text-xs text-ink-900/50">
                      {employee.employeeId}
                      {` · ${employee.position.name}`}
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

function ReadField({
  label,
  value,
  className,
}: {
  label: string;
  value?: string | null;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-900/45">{label}</dt>
      <dd className="mt-1 text-sm text-ink-900/80">{value || "—"}</dd>
    </div>
  );
}
