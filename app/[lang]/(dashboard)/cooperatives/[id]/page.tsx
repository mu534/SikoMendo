import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  MoreHorizontal,
  Building2,
  MapPin,
  Users,
  BarChart2,
  Calendar,
  ShieldCheck,
  FileCheck2,
  AlertTriangle,
  Eye,
} from "lucide-react";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getCooperativeById } from "@/features/cooperatives/queries";
import {
  updateCooperative,
  uploadCooperativeCertificate,
  archiveCooperative,
  restoreCooperative,
} from "@/features/cooperatives/actions";
import { CooperativeForm } from "@/features/cooperatives/cooperative-form";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { formatDate, formatBytes } from "@/lib/utils";
import { formatDateWithEthiopian } from "@/lib/ethiopian-calendar";
import { getSignedFileUrl } from "@/lib/cloudinary";
import { CertificateUploadPanel } from "@/features/cooperatives/certificate-upload-panel";
import { redirect } from "next/navigation";

// ── Tab type ──────────────────────────────────────────────────────────────────

type ProfileTab = "overview" | "registration" | "membership" | "financial" | "contact";

const TABS: { id: ProfileTab; label: string }[] = [
  { id: "overview",     label: "Overview" },
  { id: "registration", label: "Registration & Legal" },
  { id: "membership",   label: "Membership" },
  { id: "financial",    label: "Financial" },
  { id: "contact",      label: "Contact & Location" },
];

// ── Read-only field component ─────────────────────────────────────────────────

function ReadField({
  label,
  value,
  className,
  mono,
}: {
  label: string;
  value?: string | number | null;
  className?: string;
  mono?: boolean;
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-ink-900/45 uppercase tracking-wide">{label}</dt>
      <dd
        className={[
          "mt-1 text-sm text-ink-900",
          mono ? "font-mono" : "font-normal",
          !value && value !== 0 ? "text-ink-900/30" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {value != null && value !== "" ? value : "—"}
      </dd>
    </div>
  );
}

// ── Section sub-heading ───────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-ink-900/40">
      {children}
    </h3>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CooperativeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("VIEW_COOPERATIVES");
  const { id } = await params;
  const sp = await searchParams;

  const cooperative = await getCooperativeById(id);
  if (!cooperative) notFound();

  const canManage = can(session.user.role, "MANAGE_COOPERATIVES");

  // Parse tab from searchParams; validate against allowed values
  const rawTab = typeof sp.tab === "string" ? sp.tab : "overview";
  const tab: ProfileTab =
    TABS.some((t) => t.id === rawTab) ? (rawTab as ProfileTab) : "overview";

  const isEditMode = typeof sp.edit === "string" && sp.edit === "1" && canManage;

  // ── Derived values ──────────────────────────────────────────────────────────
  const totalShareValue =
    cooperative.numberOfShares != null && cooperative.pricePerShare != null
      ? cooperative.numberOfShares * Number(cooperative.pricePerShare)
      : null;

  const totalCapital =
    cooperative.fixedAssets != null && cooperative.currentAssets != null
      ? Number(cooperative.fixedAssets) + Number(cooperative.currentAssets)
      : null;

  // Signed URL for the legal certificate — generated server-side, valid 5 min
  const certViewUrl =
    cooperative.legalCertificateKey
      ? getSignedFileUrl(
          cooperative.legalCertificateKey,
          (cooperative.legalCertificateResourceType ?? "raw") as "image" | "raw"
        )
      : null;

  // ── Form values for edit mode ───────────────────────────────────────────────
  const cooperativeFormValues = {
    cooperativeId: cooperative.cooperativeId,
    name: cooperative.name,
    cooperativeType: cooperative.cooperativeType ?? "",
    registrationNumber: cooperative.registrationNumber ?? "",
    registrationDate: cooperative.registrationDate
      ? cooperative.registrationDate.toISOString()
      : "",
    dateJoinedUnion: cooperative.dateJoinedUnion
      ? cooperative.dateJoinedUnion.toISOString()
      : "",
    isActive: cooperative.isActive,
    district: cooperative.district ?? "",
    kebele: cooperative.kebele ?? "",
    businessType: cooperative.businessType ?? "",
    registrationFee:
      cooperative.registrationFee != null ? Number(cooperative.registrationFee) : 0,
    numberOfShares: cooperative.numberOfShares ?? 0,
    pricePerShare:
      cooperative.pricePerShare != null ? Number(cooperative.pricePerShare) : 0,
    totalMembers: cooperative.totalMembers ?? 0,
    maleMembers: cooperative.maleMembers ?? 0,
    femaleMembers: cooperative.femaleMembers ?? 0,
    fixedAssets: cooperative.fixedAssets != null ? Number(cooperative.fixedAssets) : 0,
    currentAssets:
      cooperative.currentAssets != null ? Number(cooperative.currentAssets) : 0,
    description: cooperative.description,
    location: cooperative.location,
    contactPerson: cooperative.contactPerson,
    contactEmail: cooperative.contactEmail,
    contactPhone: cooperative.contactPhone,
    legalCertificateFileName: cooperative.legalCertificateFileName,
    legalCertificateFileSize: cooperative.legalCertificateFileSize,
    legalCertificateViewUrl: certViewUrl,
  };

  // ── Status badge helper ─────────────────────────────────────────────────────
  const statusBadge = cooperative.deletedAt ? (
    <Badge tone="neutral">
      <span className="h-1.5 w-1.5 rounded-full bg-ink-400" aria-hidden="true" />
      Archived
    </Badge>
  ) : cooperative.isActive ? (
    <Badge tone="success">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
      Active
    </Badge>
  ) : (
    <Badge tone="warning">
      <span className="h-1.5 w-1.5 rounded-full bg-gold-500" aria-hidden="true" />
      Inactive
    </Badge>
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Back link ────────────────────────────────────────────────────── */}
      <Link
        href="/cooperatives"
        className="inline-flex items-center gap-1.5 text-sm text-ink-900/50 hover:text-ink-900 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to cooperatives
      </Link>

      {/* ── Profile header ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          {/* Icon avatar */}
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 shadow-sm">
            <Building2 className="h-7 w-7" aria-hidden="true" />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-semibold text-ink-900">
                {cooperative.name}
              </h1>
              <span className="rounded bg-ink-900/6 px-2 py-0.5 font-mono text-xs font-medium text-ink-900/60">
                {cooperative.cooperativeId}
              </span>
              {statusBadge}
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-ink-900/55">
              {(cooperative.district || cooperative.location) && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  {cooperative.district && cooperative.location
                    ? `${cooperative.district} · ${cooperative.location}`
                    : cooperative.district ?? cooperative.location}
                </span>
              )}
              {cooperative.cooperativeType && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {cooperative.cooperativeType}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        {canManage && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {!isEditMode && (
              <ButtonLink
                href={`/cooperatives/${id}?edit=1`}
                variant="outline"
                size="sm"
              >
                <Pencil className="h-4 w-4" />
                Edit Cooperative
              </ButtonLink>
            )}
            {isEditMode && (
              <ButtonLink
                href={`/cooperatives/${id}`}
                variant="ghost"
                size="sm"
              >
                ← Back to profile
              </ButtonLink>
            )}
            {/* Archive / Restore */}
            {!isEditMode && (
              cooperative.deletedAt ? (
                <form
                  action={async () => {
                    "use server";
                    await restoreCooperative(id);
                    redirect(`/cooperatives/${id}`);
                  }}
                >
                  <ConfirmSubmitButton
                    variant="outline"
                    size="sm"
                    confirmMessage={`Restore "${cooperative.name}"? It will return to the active list.`}
                    confirmLabel="Restore"
                  >
                    Restore
                  </ConfirmSubmitButton>
                </form>
              ) : (
                <form
                  action={async () => {
                    "use server";
                    const result = await archiveCooperative(id);
                    if (!result.success) {
                      redirect(`/cooperatives/${id}?error=${encodeURIComponent(result.error.message)}`);
                    }
                    redirect("/cooperatives");
                  }}
                >
                  <ConfirmSubmitButton
                    size="sm"
                    confirmMessage={`Archive "${cooperative.name}"? All data is preserved and can be restored.`}
                    confirmLabel="Archive"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    Archive
                  </ConfirmSubmitButton>
                </form>
              )
            )}
          </div>
        )}
      </div>

      {/* ── Compact summary strip ────────────────────────────────────────── */}
      {!isEditMode && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryTile
            icon={<Users className="h-4 w-4" />}
            label="Total Members"
            value={
              cooperative.totalMembers != null
                ? cooperative.totalMembers.toLocaleString()
                : "—"
            }
          />
          <SummaryTile
            icon={<BarChart2 className="h-4 w-4" />}
            label="Total Capital"
            value={
              totalCapital != null
                ? `${totalCapital.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`
                : "—"
            }
          />
          <SummaryTile
            icon={<BarChart2 className="h-4 w-4" />}
            label="Number of Shares"
            value={
              cooperative.numberOfShares != null
                ? cooperative.numberOfShares.toLocaleString()
                : "—"
            }
          />
          <SummaryTile
            icon={<Calendar className="h-4 w-4" />}
            label="Joined Union"
            value={
              cooperative.dateJoinedUnion
                ? formatDate(cooperative.dateJoinedUnion)
                : "—"
            }
          />
        </div>
      )}

      {/* ── Edit mode: render full form ──────────────────────────────────── */}
      {isEditMode && (
        <div className="space-y-2">
          <p className="text-sm text-ink-900/55">
            Editing <span className="font-medium text-ink-900">{cooperative.name}</span>. Use the tabs on the profile to return to the read-only view.
          </p>
          <CooperativeForm
            action={updateCooperative.bind(null, cooperative.id)}
            cooperative={cooperativeFormValues}
            cooperativeId={cooperative.cooperativeId}
          />
        </div>
      )}

      {/* ── Profile tabs + content ───────────────────────────────────────── */}
      {!isEditMode && (
        <>
          {/* Tab bar */}
          <div className="border-b border-ink-900/8">
            <nav
              className="-mb-px flex gap-1 overflow-x-auto"
              aria-label="Cooperative profile sections"
            >
              {TABS.map((t) => (
                <Link
                  key={t.id}
                  href={`/cooperatives/${id}?tab=${t.id}`}
                  aria-current={tab === t.id ? "page" : undefined}
                  className={[
                    "shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap",
                    tab === t.id
                      ? "border-brand-600 text-brand-700"
                      : "border-transparent text-ink-900/50 hover:border-ink-900/20 hover:text-ink-900",
                  ].join(" ")}
                >
                  {t.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* ── Overview tab ──────────────────────────────────────────────── */}
          {tab === "overview" && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              {/* Main info card */}
              <Card className="p-6 lg:col-span-2">
                <SectionHeading>Basic Information</SectionHeading>
                <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <ReadField label="Cooperative Name" value={cooperative.name} />
                  <ReadField label="Cooperative ID" value={cooperative.cooperativeId} mono />
                  <ReadField label="Cooperative Type" value={cooperative.cooperativeType} />
                  <ReadField label="Status" value={cooperative.isActive ? "Active" : "Inactive"} />
                  <ReadField label="District / Aanaa" value={cooperative.district} />
                  <ReadField label="Ganda" value={cooperative.kebele} />
                  <ReadField label="Location" value={cooperative.location} />
                  <ReadField
                    label="Date Joined Union"
                    value={formatDateWithEthiopian(cooperative.dateJoinedUnion)}
                  />
                  {cooperative.description && (
                    <ReadField
                      label="Description"
                      value={cooperative.description}
                      className="sm:col-span-2"
                    />
                  )}
                </dl>
              </Card>

              {/* Right column: cert status + quick stats */}
              <div className="space-y-4">
                {/* Certificate status */}
                <Card className="p-5">
                  <SectionHeading>Legal Certificate</SectionHeading>
                  {cooperative.legalCertificateKey ? (
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                        <FileCheck2 className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-emerald-900">Certificate uploaded</p>
                        <p className="mt-0.5 truncate text-xs text-emerald-700">
                          {cooperative.legalCertificateFileName ?? "certificate"}
                        </p>
                        {cooperative.legalCertificateFileSize != null && (
                          <p className="text-xs text-emerald-600/70">
                            {formatBytes(cooperative.legalCertificateFileSize)}
                          </p>
                        )}
                        {certViewUrl && (
                          <a
                            href={certViewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                            aria-label="View legal certificate"
                          >
                            <Eye className="h-3 w-3" aria-hidden="true" />
                            View certificate
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-amber-900">
                          Legal certificate required
                        </p>
                        <p className="mt-0.5 text-xs text-amber-700">
                          Upload a certificate in the Registration &amp; Legal tab.
                        </p>
                      </div>
                    </div>
                  )}
                </Card>

                {/* Quick stats */}
                <Card className="p-5">
                  <SectionHeading>At a Glance</SectionHeading>
                  <dl className="space-y-3">
                    <GlanceStat
                      label="Registration Number"
                      value={cooperative.registrationNumber ?? "—"}
                    />
                    <GlanceStat
                      label="Registration Date"
                      value={formatDate(cooperative.registrationDate)}
                    />
                    <GlanceStat
                      label="Contact Person"
                      value={cooperative.contactPerson ?? "—"}
                    />
                    <GlanceStat
                      label="Contact Phone"
                      value={cooperative.contactPhone ?? "—"}
                    />
                  </dl>
                </Card>
              </div>
            </div>
          )}

          {/* ── Registration & Legal tab ───────────────────────────────────── */}
          {tab === "registration" && (
            <div className="space-y-5">
              <Card className="p-6">
                <SectionHeading>Registration Details</SectionHeading>
                <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <ReadField label="Cooperative Type" value={cooperative.cooperativeType} />
                  <ReadField label="Registration Number" value={cooperative.registrationNumber} mono />
                  <ReadField
                    label="Registration Date"
                    value={formatDateWithEthiopian(cooperative.registrationDate)}
                  />
                  <ReadField
                    label="Date Joined Union"
                    value={formatDateWithEthiopian(cooperative.dateJoinedUnion)}
                  />
                  <ReadField
                    label="Registration Fee"
                    value={
                      cooperative.registrationFee != null
                        ? `${Number(cooperative.registrationFee).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`
                        : null
                    }
                  />
                  <ReadField label="Business Type / Gosa Hojii" value={cooperative.businessType} />
                </dl>
              </Card>

              {/* Legal certificate panel */}
              <Card className="p-6">
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <h3 className="font-display text-base font-semibold text-ink-900">
                    Legal Certificate
                  </h3>
                </div>

                {cooperative.legalCertificateKey ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                          <FileCheck2 className="h-4.5 w-4.5" aria-hidden="true" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-emerald-900">
                            ✓ Legal certificate uploaded
                          </p>
                          <p className="mt-0.5 text-xs text-emerald-700">
                            {cooperative.legalCertificateFileName ?? "certificate"}
                            {cooperative.legalCertificateFileSize != null && (
                              <span className="ml-1 text-emerald-600/70">
                                · {formatBytes(cooperative.legalCertificateFileSize)}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      {certViewUrl && (
                        <a
                          href={certViewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 text-xs font-medium text-emerald-800 hover:bg-emerald-50 transition-colors"
                          aria-label="View legal certificate"
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                          View
                        </a>
                      )}
                    </div>

                    {/* Replace panel — authorized users only */}
                    {canManage && (
                      <CertificateUploadPanel
                        cooperativeId={id}
                        action={uploadCooperativeCertificate.bind(null, id)}
                        mode="replace"
                      />
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-medium text-amber-900">
                          Legal certificate required
                        </p>
                        <p className="mt-0.5 text-xs text-amber-700">
                          An official cooperative registration certificate must be uploaded.
                        </p>
                      </div>
                    </div>

                    {canManage && (
                      <CertificateUploadPanel
                        cooperativeId={id}
                        action={uploadCooperativeCertificate.bind(null, id)}
                        mode="upload"
                      />
                    )}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ── Membership tab ────────────────────────────────────────────── */}
          {tab === "membership" && (
            <Card className="p-6">
              <SectionHeading>Membership Information</SectionHeading>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                {/* Big stat cards */}
                <MemberStatCard
                  label="Total Members"
                  value={cooperative.totalMembers}
                  tone="brand"
                />
                <MemberStatCard
                  label="Male Members"
                  value={cooperative.maleMembers}
                  tone="neutral"
                />
                <MemberStatCard
                  label="Female Members"
                  value={cooperative.femaleMembers}
                  tone="neutral"
                />
              </div>

              {/* Distribution bar */}
              {cooperative.totalMembers != null &&
                cooperative.totalMembers > 0 &&
                cooperative.maleMembers != null &&
                cooperative.femaleMembers != null && (
                  <div className="mt-6">
                    <SectionHeading>Gender Distribution</SectionHeading>
                    <div className="space-y-2">
                      <DistributionBar
                        label="Male"
                        count={cooperative.maleMembers}
                        total={cooperative.totalMembers}
                        colorClass="bg-brand-500"
                      />
                      <DistributionBar
                        label="Female"
                        count={cooperative.femaleMembers}
                        total={cooperative.totalMembers}
                        colorClass="bg-emerald-500"
                      />
                    </div>
                  </div>
                )}
            </Card>
          )}

          {/* ── Financial tab ─────────────────────────────────────────────── */}
          {tab === "financial" && (
            <div className="space-y-5">
              {/* Capital cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <FinancialCard
                  label="Fixed Assets / Dhaabbataa"
                  value={cooperative.fixedAssets != null ? Number(cooperative.fixedAssets) : null}
                  highlight={false}
                />
                <FinancialCard
                  label="Current Assets / Socho'aa"
                  value={cooperative.currentAssets != null ? Number(cooperative.currentAssets) : null}
                  highlight={false}
                />
                <FinancialCard
                  label="Total Capital"
                  value={totalCapital}
                  highlight
                />
              </div>

              {/* Share details */}
              <Card className="p-6">
                <SectionHeading>Share Information</SectionHeading>
                <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                  <ReadField
                    label="Number of Shares"
                    value={
                      cooperative.numberOfShares != null
                        ? cooperative.numberOfShares.toLocaleString()
                        : null
                    }
                  />
                  <ReadField
                    label="Price Per Share"
                    value={
                      cooperative.pricePerShare != null
                        ? `${Number(cooperative.pricePerShare).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`
                        : null
                    }
                  />
                  <ReadField
                    label="Total Share Value"
                    value={
                      totalShareValue != null
                        ? `${totalShareValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`
                        : null
                    }
                  />
                </dl>
              </Card>
            </div>
          )}

          {/* ── Contact & Location tab ────────────────────────────────────── */}
          {tab === "contact" && (
            <Card className="p-6">
              <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <ReadField label="District / Aanaa" value={cooperative.district} />
                <ReadField label="Ganda" value={cooperative.kebele} />
                <ReadField label="Location" value={cooperative.location} />
                <ReadField label="Contact Person" value={cooperative.contactPerson} />
                <ReadField label="Contact Phone" value={cooperative.contactPhone} />
                <ReadField label="Contact Email" value={cooperative.contactEmail} />
                {cooperative.description && (
                  <ReadField
                    label="Description"
                    value={cooperative.description}
                    className="sm:col-span-2"
                  />
                )}
              </dl>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ── Small display-only components ────────────────────────────────────────────

function SummaryTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-ink-900/8 bg-white px-4 py-3.5 shadow-sm shadow-ink-900/[0.02]">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink-900/50">{label}</p>
        <p className="truncate text-sm font-semibold text-ink-900">{value}</p>
      </div>
    </div>
  );
}

function GlanceStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="text-xs text-ink-900/45">{label}</dt>
      <dd className="text-right text-xs font-medium text-ink-900">{value}</dd>
    </div>
  );
}

function MemberStatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | null;
  tone: "brand" | "neutral";
}) {
  const bg = tone === "brand" ? "bg-brand-50" : "bg-sand-50";
  const text = tone === "brand" ? "text-brand-700" : "text-ink-900/60";
  return (
    <div className={`rounded-xl border border-ink-900/8 ${bg} px-5 py-4`}>
      <p className={`text-xs font-medium uppercase tracking-wide ${text}`}>{label}</p>
      <p className="font-display mt-1.5 text-3xl font-semibold text-ink-900">
        {value != null ? value.toLocaleString() : "—"}
      </p>
    </div>
  );
}

function DistributionBar({
  label,
  count,
  total,
  colorClass,
}: {
  label: string;
  count: number;
  total: number;
  colorClass: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-ink-900/70">{label}</span>
        <span className="tabular-nums text-ink-900/50">
          {count.toLocaleString()} · {pct}%
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-ink-900/8"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} ${pct}%`}
      >
        <div
          className={`h-full rounded-full ${colorClass} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function FinancialCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number | null;
  highlight: boolean;
}) {
  return (
    <div
      className={[
        "rounded-2xl border p-5",
        highlight
          ? "border-brand-200 bg-brand-50"
          : "border-ink-900/8 bg-white shadow-sm shadow-ink-900/[0.02]",
      ].join(" ")}
    >
      <p
        className={`text-xs font-medium uppercase tracking-wide ${highlight ? "text-brand-600" : "text-ink-900/50"}`}
      >
        {label}
      </p>
      <p
        className={`font-display mt-2 text-2xl font-semibold ${highlight ? "text-brand-800" : "text-ink-900"}`}
      >
        {value != null
          ? value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : "—"}
      </p>
      {highlight && (
        <p className="mt-0.5 text-xs text-brand-500">Fixed Assets + Current Assets</p>
      )}
    </div>
  );
}
