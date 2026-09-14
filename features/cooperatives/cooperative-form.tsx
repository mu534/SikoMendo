"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, MapPin, Users, BarChart2, ShieldCheck } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { BasicInformationSection } from "./form-sections/BasicInformationSection";
import { AddressInformationSection } from "./form-sections/AddressInformationSection";
import { RegistrationDetailsSection } from "./form-sections/RegistrationDetailsSection";
import { MembershipSection } from "./form-sections/MembershipSection";
import { CapitalSection } from "./form-sections/CapitalSection";
import { ContactSection } from "./form-sections/ContactSection";
import type { CooperativeFormValues } from "./form-utils";

// Re-export so existing importers of the old location keep working
export type { CooperativeFormValues };

// ─── Component ────────────────────────────────────────────────────────────────

export function CooperativeForm({
  action,
  cooperative,
  cooperativeId,
}: {
  action: (
    prevState: { success: boolean; data?: unknown; error?: { message: string } } | null,
    formData: FormData
  ) => Promise<{ success: boolean; data?: unknown; error?: { message: string } }>;
  cooperative?: CooperativeFormValues;
  cooperativeId?: string;
}) {
  const router = useRouter();
  const isCreate = !cooperative;
  const [state, formAction, isPending] = useActionState(action, null);

  // Redirect to detail page on successful create
  useEffect(() => {
    if (state && (state as { success: boolean }).success === true && isCreate) {
      const id = (state as { data: { id: string } }).data.id;
      router.push(`/cooperatives/${id}`);
    }
  }, [state, router, isCreate]);

  // Success toast on update
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  useEffect(() => {
    if (state && (state as { success: boolean }).success === true && !isCreate) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowSuccessToast(true);
      const t = setTimeout(() => setShowSuccessToast(false), 3500);
      return () => clearTimeout(t);
    }
  }, [state, isCreate]);

  const stateTyped = state as
    | { success: true; data: { id: string } }
    | { success: false; error: { message: string } }
    | null;

  const errorMessage =
    stateTyped && stateTyped.success === false ? stateTyped.error.message : null;

  // ── Controlled state for calculated / summary fields ───────────────────────
  const [name, setName] = useState(cooperative?.name ?? "");
  const [district, setDistrict] = useState(cooperative?.district ?? "");
  const [numShares, setNumShares] = useState(
    cooperative ? String(cooperative.numberOfShares) : ""
  );
  const [priceShare, setPriceShare] = useState(
    cooperative ? String(cooperative.pricePerShare) : ""
  );
  const [fixedAssets, setFixedAssets] = useState(
    cooperative ? String(cooperative.fixedAssets) : ""
  );
  const [currentAssets, setCurrentAssets] = useState(
    cooperative ? String(cooperative.currentAssets) : ""
  );
  const [totalMembers, setTotalMembers] = useState(
    cooperative ? String(cooperative.totalMembers) : ""
  );
  const [maleMembers, setMaleMembers] = useState(
    cooperative ? String(cooperative.maleMembers) : ""
  );
  const [femaleMembers, setFemaleMembers] = useState(
    cooperative ? String(cooperative.femaleMembers) : ""
  );
  const [certUploaded, setCertUploaded] = useState(
    !!cooperative?.legalCertificateFileName
  );

  const totalShareValue =
    numShares !== "" && priceShare !== ""
      ? (parseFloat(numShares) || 0) * (parseFloat(priceShare) || 0)
      : null;

  const totalCapital =
    fixedAssets !== "" || currentAssets !== ""
      ? (parseFloat(fixedAssets) || 0) + (parseFloat(currentAssets) || 0)
      : null;

  const memberMismatch =
    totalMembers !== "" && maleMembers !== "" && femaleMembers !== ""
      ? (parseInt(maleMembers) || 0) + (parseInt(femaleMembers) || 0) !==
        (parseInt(totalMembers) || 0)
      : false;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
      {/* ── Main form ──────────────────────────────────────────────────────── */}
      <div className="min-w-0 flex-1 max-w-3xl space-y-5">
        {/* Success toast */}
        {showSuccessToast && (
          <div
            role="status"
            className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800"
          >
            Changes saved successfully.
          </div>
        )}

        {/* Error banner */}
        {errorMessage && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            {errorMessage}
          </div>
        )}

        <form action={formAction} noValidate className="space-y-5">

          {/* ── Section 1: Basic Information ─────────────────────────────── */}
          <BasicInformationSection
            cooperative={cooperative}
            cooperativeId={cooperativeId}
            onNameChange={setName}
          />

          {/* ── Section 2: Address Information ───────────────────────────── */}
          <AddressInformationSection
            cooperative={cooperative}
            onDistrictChange={setDistrict}
          />

          {/* ── Section 3: Registration & Legal (includes certificate) ────── */}
          <RegistrationDetailsSection
            cooperative={cooperative}
            numShares={numShares}
            priceShare={priceShare}
            totalShareValue={totalShareValue}
            onNumSharesChange={setNumShares}
            onPriceShareChange={setPriceShare}
            isCreate={isCreate}
            onCertChange={setCertUploaded}
          />

          {/* ── Section 4: Membership Information ────────────────────────── */}
          <MembershipSection
            totalMembers={totalMembers}
            maleMembers={maleMembers}
            femaleMembers={femaleMembers}
            memberMismatch={memberMismatch}
            onTotalChange={setTotalMembers}
            onMaleChange={setMaleMembers}
            onFemaleChange={setFemaleMembers}
          />

          {/* ── Section 5: Capital Information ───────────────────────────── */}
          <CapitalSection
            fixedAssets={fixedAssets}
            currentAssets={currentAssets}
            totalCapital={totalCapital}
            onFixedAssetsChange={setFixedAssets}
            onCurrentAssetsChange={setCurrentAssets}
          />

          {/* ── Section 6: Contact & Additional ──────────────────────────── */}
          <ContactSection cooperative={cooperative} />

          {/* ── Action Buttons ────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-3 border-t border-ink-900/8 pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                  Saving…
                </span>
              ) : isCreate ? (
                "Create cooperative"
              ) : (
                "Save changes"
              )}
            </Button>
            <Button type="reset" variant="outline">
              Reset
            </Button>
            <ButtonLink href="/cooperatives" variant="ghost">
              Cancel
            </ButtonLink>
          </div>
        </form>
      </div>

      {/* ── Live Summary Sidebar (desktop only) ────────────────────────────── */}
      <aside
        className="hidden w-64 shrink-0 xl:block"
        aria-label="Cooperative summary"
      >
        <div className="sticky top-6 rounded-2xl border border-ink-900/8 bg-white p-5 shadow-sm shadow-ink-900/[0.02]">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-ink-900/45">
            Cooperative Summary
          </p>

          <ul className="space-y-3.5 text-sm">
            <SummaryRow
              icon={<Building2 className="h-3.5 w-3.5" />}
              label="Name"
              value={name || "—"}
            />
            <SummaryRow
              icon={<MapPin className="h-3.5 w-3.5" />}
              label="District"
              value={district || "—"}
            />
            <SummaryRow
              icon={<Users className="h-3.5 w-3.5" />}
              label="Members"
              value={totalMembers !== "" ? Number(totalMembers).toLocaleString() : "—"}
            />
            <SummaryRow
              icon={<BarChart2 className="h-3.5 w-3.5" />}
              label="Shares"
              value={numShares !== "" ? Number(numShares).toLocaleString() : "—"}
            />
            <SummaryRow
              icon={<BarChart2 className="h-3.5 w-3.5" />}
              label="Total Capital"
              value={
                totalCapital != null
                  ? `${totalCapital.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`
                  : "—"
              }
            />
            <li className="flex items-start gap-2.5 border-t border-ink-900/6 pt-3.5">
              <span
                className={[
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]",
                  certUploaded
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-600",
                ].join(" ")}
                aria-hidden="true"
              >
                <ShieldCheck className="h-3 w-3" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-ink-900/50">Legal Certificate</p>
                <p
                  className={[
                    "text-sm font-medium",
                    certUploaded ? "text-emerald-700" : "text-amber-600",
                  ].join(" ")}
                >
                  {certUploaded ? "✓ Uploaded" : "Required"}
                </p>
              </div>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}

// ── Summary row helper ─────────────────────────────────────────────────────────

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink-900/50">{label}</p>
        <p className="truncate text-sm font-medium text-ink-900">{value}</p>
      </div>
    </li>
  );
}
