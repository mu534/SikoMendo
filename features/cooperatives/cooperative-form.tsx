"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  const [state, formAction, isPending] = useActionState(action, null);

  // Redirect to detail page on successful create
  useEffect(() => {
    if (state && (state as { success: boolean }).success === true && !cooperative) {
      const id = (state as { data: { id: string } }).data.id;
      router.push(`/cooperatives/${id}`);
    }
  }, [state, router, cooperative]);

  // Success toast on update
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  useEffect(() => {
    if (state && (state as { success: boolean }).success === true && !!cooperative) {
      // Reacting to a useActionState result changing (an external system) —
      // not a derived-state anti-pattern.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowSuccessToast(true);
      const t = setTimeout(() => setShowSuccessToast(false), 3500);
      return () => clearTimeout(t);
    }
  }, [state, cooperative]);

  const stateTyped = state as
    | { success: true; data: { id: string } }
    | { success: false; error: { message: string } }
    | null;

  const errorMessage =
    stateTyped && stateTyped.success === false ? stateTyped.error.message : null;

  // ── Controlled state for calculated fields ─────────────────────────────────
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
    <div className="max-w-3xl space-y-5">
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

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 1 — Basic Information
        ══════════════════════════════════════════════════════════════════ */}
        <BasicInformationSection cooperative={cooperative} cooperativeId={cooperativeId} />

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 2 — Address Information
        ══════════════════════════════════════════════════════════════════ */}
        <AddressInformationSection cooperative={cooperative} />

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 3 — Registration Details
        ══════════════════════════════════════════════════════════════════ */}
        <RegistrationDetailsSection
          cooperative={cooperative}
          numShares={numShares}
          priceShare={priceShare}
          totalShareValue={totalShareValue}
          onNumSharesChange={setNumShares}
          onPriceShareChange={setPriceShare}
        />

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 4 — Membership Information
        ══════════════════════════════════════════════════════════════════ */}
        <MembershipSection
          totalMembers={totalMembers}
          maleMembers={maleMembers}
          femaleMembers={femaleMembers}
          memberMismatch={memberMismatch}
          onTotalChange={setTotalMembers}
          onMaleChange={setMaleMembers}
          onFemaleChange={setFemaleMembers}
        />

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 5 — Capital Information
        ══════════════════════════════════════════════════════════════════ */}
        <CapitalSection
          fixedAssets={fixedAssets}
          currentAssets={currentAssets}
          totalCapital={totalCapital}
          onFixedAssetsChange={setFixedAssets}
          onCurrentAssetsChange={setCurrentAssets}
        />

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 6 — Contact & Additional (all optional)
        ══════════════════════════════════════════════════════════════════ */}
        <ContactSection cooperative={cooperative} />

        {/* ── Action Buttons ───────────────────────────────────────────────── */}
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
            ) : cooperative ? (
              "Save changes"
            ) : (
              "Create cooperative"
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
  );
}
