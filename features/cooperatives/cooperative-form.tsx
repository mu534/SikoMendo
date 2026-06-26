"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, MapPin, FileText, Users, Wallet } from "lucide-react";
import { Input, Label, Select, Textarea, FieldGroup, FieldError } from "@/components/ui/field";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CooperativeFormValues = {
  cooperativeId?: string;           // Auto-generated, read-only

  // Section 1 — Basic (required)
  name: string;
  cooperativeType: string;
  registrationNumber: string;
  registrationDate: Date;
  dateJoinedUnion: Date;
  isActive: boolean;

  // Section 2 — Address (required)
  district: string;
  kebele: string;

  // Section 3 — Registration Details (required)
  businessType: string;
  registrationFee: number;
  numberOfShares: number;
  pricePerShare: number;

  // Section 4 — Membership (required)
  totalMembers: number;
  maleMembers: number;
  femaleMembers: number;

  // Section 5 — Capital (required)
  fixedAssets: number;
  currentAssets: number;

  // Section 6 — Contact & Additional (all optional)
  description?: string | null;
  location?: string | null;
  contactPerson?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateInputValue(date?: Date | null): string {
  if (!date) return "";
  return new Date(date).toISOString().split("T")[0];
}

function RequiredMark() {
  return <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>;
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="mb-5 flex items-center gap-2.5 border-b border-ink-900/8 pb-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="font-display text-base font-semibold text-ink-900">{title}</h3>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CooperativeForm({
  action,
  cooperative,
  cooperativeId,
}: {
  action: (prevState: unknown, formData: FormData) => Promise<unknown>;
  cooperative?: CooperativeFormValues;
  cooperativeId?: string;
}) {
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [state, formAction, isPending] = useActionState(action as any, null);

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
        <Card className="p-6">
          <SectionHeader icon={Building2} title="Basic Information" />
          <div className="space-y-5">

            {/* Row: Cooperative ID (read-only) + Cooperative Name* */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FieldGroup>
                <Label htmlFor="cooperativeId_display">Cooperative ID</Label>
                <Input
                  id="cooperativeId_display"
                  readOnly
                  tabIndex={-1}
                  aria-readonly="true"
                  value={cooperative?.cooperativeId ?? cooperativeId ?? "Auto-generated"}
                  className="cursor-default bg-sand-100"
                />
              </FieldGroup>

              <FieldGroup>
                <Label htmlFor="name">
                  Cooperative Name<RequiredMark />
                </Label>
                <Input
                  id="name"
                  name="name"
                  required
                  aria-required="true"
                  defaultValue={cooperative?.name ?? ""}
                  placeholder="e.g. Bale Farmers Cooperative"
                />
              </FieldGroup>
            </div>

            {/* Row: Cooperative Type* + Registration Number* */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FieldGroup>
                <Label htmlFor="cooperativeType">
                  Cooperative Type<RequiredMark />
                </Label>
                <Select
                  id="cooperativeType"
                  name="cooperativeType"
                  required
                  aria-required="true"
                  defaultValue={cooperative?.cooperativeType ?? ""}
                >
                  <option value="">Select type…</option>
                  <option value="Agricultural">Agricultural</option>
                  <option value="Savings & Credit">Savings &amp; Credit</option>
                  <option value="Consumer">Consumer</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Service">Service</option>
                  <option value="Multi-Purpose">Multi-Purpose</option>
                </Select>
              </FieldGroup>

              <FieldGroup>
                <Label htmlFor="registrationNumber">
                  Registration Number<RequiredMark />
                </Label>
                <Input
                  id="registrationNumber"
                  name="registrationNumber"
                  required
                  aria-required="true"
                  defaultValue={cooperative?.registrationNumber ?? ""}
                />
              </FieldGroup>
            </div>

            {/* Row: Registration Date* + Date Joined Union* */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FieldGroup>
                <Label htmlFor="registrationDate">
                  Registration Date<RequiredMark />
                </Label>
                <Input
                  id="registrationDate"
                  name="registrationDate"
                  type="date"
                  required
                  aria-required="true"
                  defaultValue={toDateInputValue(cooperative?.registrationDate)}
                />
              </FieldGroup>

              <FieldGroup>
                <Label htmlFor="dateJoinedUnion">
                  Date Joined Union<RequiredMark />
                </Label>
                <Input
                  id="dateJoinedUnion"
                  name="dateJoinedUnion"
                  type="date"
                  required
                  aria-required="true"
                  defaultValue={toDateInputValue(cooperative?.dateJoinedUnion)}
                />
              </FieldGroup>
            </div>

            {/* Row: Status* (half-width) */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FieldGroup>
                <Label htmlFor="isActive">
                  Status<RequiredMark />
                </Label>
                <Select
                  id="isActive"
                  name="isActive"
                  required
                  aria-required="true"
                  defaultValue={cooperative?.isActive === false ? "false" : "true"}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </Select>
              </FieldGroup>
            </div>
          </div>
        </Card>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 2 — Address Information
        ══════════════════════════════════════════════════════════════════ */}
        <Card className="p-6">
          <SectionHeader icon={MapPin} title="Address Information" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FieldGroup>
              <Label htmlFor="district">
                District / Aanaa<RequiredMark />
              </Label>
              <Input
                id="district"
                name="district"
                required
                aria-required="true"
                defaultValue={cooperative?.district ?? ""}
                placeholder="e.g. Goba"
              />
            </FieldGroup>

            <FieldGroup>
              <Label htmlFor="kebele">
                Kebele / Ganda<RequiredMark />
              </Label>
              <Input
                id="kebele"
                name="kebele"
                required
                aria-required="true"
                defaultValue={cooperative?.kebele ?? ""}
                placeholder="e.g. 01"
              />
            </FieldGroup>
          </div>
        </Card>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 3 — Registration Details
        ══════════════════════════════════════════════════════════════════ */}
        <Card className="p-6">
          <SectionHeader icon={FileText} title="Registration Details" />
          <div className="space-y-5">

            {/* Row: Business Type* + Registration Fee* */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FieldGroup>
                <Label htmlFor="businessType">
                  Business Type / Gosa Hojii<RequiredMark />
                </Label>
                <Input
                  id="businessType"
                  name="businessType"
                  required
                  aria-required="true"
                  defaultValue={cooperative?.businessType ?? ""}
                />
              </FieldGroup>

              <FieldGroup>
                <Label htmlFor="registrationFee">
                  Registration Fee / Kaffaltii Galmee<RequiredMark />
                </Label>
                <Input
                  id="registrationFee"
                  name="registrationFee"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  aria-required="true"
                  defaultValue={
                    cooperative?.registrationFee != null
                      ? String(cooperative.registrationFee)
                      : ""
                  }
                />
              </FieldGroup>
            </div>

            {/* Row: Number of Shares* + Price Per Share* */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FieldGroup>
                <Label htmlFor="numberOfShares">
                  Number of Shares / Qooda Bitataa<RequiredMark />
                </Label>
                <Input
                  id="numberOfShares"
                  name="numberOfShares"
                  type="number"
                  min="0"
                  step="1"
                  required
                  aria-required="true"
                  value={numShares}
                  onChange={(e) => setNumShares(e.target.value)}
                />
              </FieldGroup>

              <FieldGroup>
                <Label htmlFor="pricePerShare">
                  Price Per Share / Gatii Qooda Tokkoo<RequiredMark />
                </Label>
                <Input
                  id="pricePerShare"
                  name="pricePerShare"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  aria-required="true"
                  value={priceShare}
                  onChange={(e) => setPriceShare(e.target.value)}
                />
              </FieldGroup>
            </div>

            {/* Total Share Value — read-only, auto-calculated */}
            <FieldGroup>
              <Label htmlFor="totalShareValue">Total Share Value (auto-calculated)</Label>
              <Input
                id="totalShareValue"
                readOnly
                tabIndex={-1}
                aria-readonly="true"
                className="cursor-default bg-sand-100"
                value={
                  totalShareValue != null
                    ? totalShareValue.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : ""
                }
                placeholder="Calculated from shares × price per share"
              />
            </FieldGroup>
          </div>
        </Card>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 4 — Membership Information
        ══════════════════════════════════════════════════════════════════ */}
        <Card className="p-6">
          <SectionHeader icon={Users} title="Membership Information" />
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FieldGroup>
                <Label htmlFor="totalMembers">
                  Total Members<RequiredMark />
                </Label>
                <Input
                  id="totalMembers"
                  name="totalMembers"
                  type="number"
                  min="0"
                  step="1"
                  required
                  aria-required="true"
                  value={totalMembers}
                  onChange={(e) => setTotalMembers(e.target.value)}
                />
                {memberMismatch && (
                  <FieldError>Male + Female members must equal Total members</FieldError>
                )}
              </FieldGroup>

              {/* spacer on desktop */}
              <div className="hidden sm:block" aria-hidden="true" />

              <FieldGroup>
                <Label htmlFor="maleMembers">
                  Male Members<RequiredMark />
                </Label>
                <Input
                  id="maleMembers"
                  name="maleMembers"
                  type="number"
                  min="0"
                  step="1"
                  required
                  aria-required="true"
                  value={maleMembers}
                  onChange={(e) => setMaleMembers(e.target.value)}
                />
              </FieldGroup>

              <FieldGroup>
                <Label htmlFor="femaleMembers">
                  Female Members<RequiredMark />
                </Label>
                <Input
                  id="femaleMembers"
                  name="femaleMembers"
                  type="number"
                  min="0"
                  step="1"
                  required
                  aria-required="true"
                  value={femaleMembers}
                  onChange={(e) => setFemaleMembers(e.target.value)}
                />
              </FieldGroup>
            </div>
          </div>
        </Card>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 5 — Capital Information
        ══════════════════════════════════════════════════════════════════ */}
        <Card className="p-6">
          <SectionHeader icon={Wallet} title="Capital Information" />
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FieldGroup>
                <Label htmlFor="fixedAssets">
                  Fixed Assets / Dhaabbataa<RequiredMark />
                </Label>
                <Input
                  id="fixedAssets"
                  name="fixedAssets"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  aria-required="true"
                  value={fixedAssets}
                  onChange={(e) => setFixedAssets(e.target.value)}
                />
              </FieldGroup>

              <FieldGroup>
                <Label htmlFor="currentAssets">
                  Current Assets / Socho&apos;aa<RequiredMark />
                </Label>
                <Input
                  id="currentAssets"
                  name="currentAssets"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  aria-required="true"
                  value={currentAssets}
                  onChange={(e) => setCurrentAssets(e.target.value)}
                />
              </FieldGroup>
            </div>

            {/* Total Capital — read-only, auto-calculated */}
            <FieldGroup>
              <Label htmlFor="totalCapital">Total Capital (auto-calculated)</Label>
              <Input
                id="totalCapital"
                readOnly
                tabIndex={-1}
                aria-readonly="true"
                className="cursor-default bg-sand-100"
                value={
                  totalCapital != null
                    ? totalCapital.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : ""
                }
                placeholder="Calculated from fixed + current assets"
              />
            </FieldGroup>
          </div>
        </Card>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 6 — Contact & Additional (all optional)
        ══════════════════════════════════════════════════════════════════ */}
        <Card className="p-6">
          <SectionHeader icon={Building2} title="Contact &amp; Additional Information" />
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FieldGroup>
                <Label htmlFor="contactPerson">Contact Person</Label>
                <Input
                  id="contactPerson"
                  name="contactPerson"
                  defaultValue={cooperative?.contactPerson ?? ""}
                />
              </FieldGroup>

              <FieldGroup>
                <Label htmlFor="contactEmail">Contact Email</Label>
                <Input
                  id="contactEmail"
                  name="contactEmail"
                  type="email"
                  defaultValue={cooperative?.contactEmail ?? ""}
                />
              </FieldGroup>

              <FieldGroup>
                <Label htmlFor="contactPhone">Contact Phone</Label>
                <Input
                  id="contactPhone"
                  name="contactPhone"
                  placeholder="+251 9XX XXX XXX"
                  defaultValue={cooperative?.contactPhone ?? ""}
                />
              </FieldGroup>

              <FieldGroup>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  name="location"
                  placeholder="e.g. Robe, Bale Zone"
                  defaultValue={cooperative?.location ?? ""}
                />
              </FieldGroup>
            </div>

            <FieldGroup>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={cooperative?.description ?? ""}
              />
            </FieldGroup>
          </div>
        </Card>

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
