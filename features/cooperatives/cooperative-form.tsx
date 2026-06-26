"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, MapPin, FileText, Users, Wallet } from "lucide-react";
import { Input, Label, Select, Textarea, FieldGroup, FieldError } from "@/components/ui/field";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CooperativeFormValues = {
  cooperativeId?: string;
  name: string;
  cooperativeType?: string | null;
  registrationNumber?: string | null;
  registrationDate?: Date | null;
  dateJoinedUnion?: Date | null;
  isActive: boolean;
  district?: string | null;
  kebele?: string | null;
  businessType?: string | null;
  registrationFee?: number | null;
  numberOfShares?: number | null;
  pricePerShare?: number | null;
  totalMembers?: number | null;
  maleMembers?: number | null;
  femaleMembers?: number | null;
  fixedAssets?: number | null;
  currentAssets?: number | null;
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
  return <span className="ml-0.5 text-red-500">*</span>;
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

  // Redirect on successful create
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

  // ── Calculated field state ─────────────────────────────────────────────────
  const [numShares, setNumShares] = useState(
    cooperative?.numberOfShares != null ? String(cooperative.numberOfShares) : ""
  );
  const [priceShare, setPriceShare] = useState(
    cooperative?.pricePerShare != null ? String(cooperative.pricePerShare) : ""
  );
  const [fixedAssets, setFixedAssets] = useState(
    cooperative?.fixedAssets != null ? String(cooperative.fixedAssets) : ""
  );
  const [currentAssets, setCurrentAssets] = useState(
    cooperative?.currentAssets != null ? String(cooperative.currentAssets) : ""
  );
  const [totalMembers, setTotalMembers] = useState(
    cooperative?.totalMembers != null ? String(cooperative.totalMembers) : ""
  );
  const [maleMembers, setMaleMembers] = useState(
    cooperative?.maleMembers != null ? String(cooperative.maleMembers) : ""
  );
  const [femaleMembers, setFemaleMembers] = useState(
    cooperative?.femaleMembers != null ? String(cooperative.femaleMembers) : ""
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
      ? (parseInt(maleMembers) || 0) + (parseInt(femaleMembers) || 0) !== (parseInt(totalMembers) || 0)
      : false;

  return (
    <div className="max-w-3xl space-y-5">
      {showSuccessToast && (
        <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          Changes saved successfully.
        </div>
      )}
      {errorMessage && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {errorMessage}
        </div>
      )}

      <form action={formAction} className="space-y-5">

        {/* ── Section 1: Basic Information ─────────────────────────────────── */}
        <Card className="p-6">
          <SectionHeader icon={Building2} title="Basic Information" />
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FieldGroup>
                <Label htmlFor="cooperativeId_display">Cooperative ID</Label>
                <Input
                  id="cooperativeId_display"
                  readOnly
                  tabIndex={-1}
                  value={cooperative?.cooperativeId ?? cooperativeId ?? "Auto-generated"}
                  className="cursor-default bg-sand-100"
                  aria-readonly="true"
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
                  defaultValue={cooperative?.name}
                  placeholder="e.g. Bale Farmers Cooperative"
                />
              </FieldGroup>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FieldGroup>
                <Label htmlFor="cooperativeType">Cooperative Type</Label>
                <Select id="cooperativeType" name="cooperativeType" defaultValue={cooperative?.cooperativeType ?? ""}>
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
                <Input id="registrationNumber" name="registrationNumber" defaultValue={cooperative?.registrationNumber ?? ""} />
              </FieldGroup>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FieldGroup>
                <Label htmlFor="registrationDate">Registration Date</Label>
                <Input id="registrationDate" name="registrationDate" type="date" defaultValue={toDateInputValue(cooperative?.registrationDate)} />
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="dateJoinedUnion">Date Joined Union</Label>
                <Input id="dateJoinedUnion" name="dateJoinedUnion" type="date" defaultValue={toDateInputValue(cooperative?.dateJoinedUnion)} />
              </FieldGroup>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FieldGroup>
                <Label htmlFor="isActive">Status</Label>
                <Select id="isActive" name="isActive" defaultValue={cooperative?.isActive === false ? "false" : "true"}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </Select>
              </FieldGroup>
            </div>
          </div>
        </Card>

        {/* ── Section 2: Address Information ───────────────────────────────── */}
        <Card className="p-6">
          <SectionHeader icon={MapPin} title="Address Information" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FieldGroup>
              <Label htmlFor="district">District / Aanaa</Label>
              <Input id="district" name="district" defaultValue={cooperative?.district ?? ""} placeholder="e.g. Goba" />
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="kebele">Kebele / Ganda</Label>
              <Input id="kebele" name="kebele" defaultValue={cooperative?.kebele ?? ""} placeholder="e.g. 01" />
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="location">Location</Label>
              <Input id="location" name="location" defaultValue={cooperative?.location ?? ""} placeholder="e.g. Robe, Bale Zone" />
            </FieldGroup>
          </div>
        </Card>

        {/* ── Section 3: Registration Details ──────────────────────────────── */}
        <Card className="p-6">
          <SectionHeader icon={FileText} title="Registration Details" />
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FieldGroup>
                <Label htmlFor="businessType">Business Type / Gosa Hojii</Label>
                <Input id="businessType" name="businessType" defaultValue={cooperative?.businessType ?? ""} />
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="registrationFee">Registration Fee / Kaffaltii Galmee</Label>
                <Input id="registrationFee" name="registrationFee" type="number" min="0" step="0.01"
                  defaultValue={cooperative?.registrationFee != null ? String(cooperative.registrationFee) : ""} />
              </FieldGroup>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FieldGroup>
                <Label htmlFor="numberOfShares">Number of Shares / Qooda Bitataa</Label>
                <Input id="numberOfShares" name="numberOfShares" type="number" min="0" step="1"
                  value={numShares} onChange={(e) => setNumShares(e.target.value)} />
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="pricePerShare">Price Per Share / Gatii Qooda Tokkoo</Label>
                <Input id="pricePerShare" name="pricePerShare" type="number" min="0" step="0.01"
                  value={priceShare} onChange={(e) => setPriceShare(e.target.value)} />
              </FieldGroup>
            </div>

            <FieldGroup>
              <Label htmlFor="totalShareValue">Total Share Value (auto-calculated)</Label>
              <Input id="totalShareValue" readOnly tabIndex={-1} aria-readonly="true"
                className="cursor-default bg-sand-100"
                value={totalShareValue != null
                  ? totalShareValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  : ""}
                placeholder="Calculated from shares × price per share"
              />
            </FieldGroup>
          </div>
        </Card>

        {/* ── Section 4: Membership Information ────────────────────────────── */}
        <Card className="p-6">
          <SectionHeader icon={Users} title="Membership Information" />
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FieldGroup>
                <Label htmlFor="totalMembers">Total Members</Label>
                <Input id="totalMembers" name="totalMembers" type="number" min="0" step="1"
                  value={totalMembers} onChange={(e) => setTotalMembers(e.target.value)} />
                {memberMismatch && (
                  <FieldError>Male + Female members must equal Total members</FieldError>
                )}
              </FieldGroup>
              <div className="hidden sm:block" aria-hidden="true" />
              <FieldGroup>
                <Label htmlFor="maleMembers">Male Members</Label>
                <Input id="maleMembers" name="maleMembers" type="number" min="0" step="1"
                  value={maleMembers} onChange={(e) => setMaleMembers(e.target.value)} />
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="femaleMembers">Female Members</Label>
                <Input id="femaleMembers" name="femaleMembers" type="number" min="0" step="1"
                  value={femaleMembers} onChange={(e) => setFemaleMembers(e.target.value)} />
              </FieldGroup>
            </div>
          </div>
        </Card>

        {/* ── Section 5: Capital Information ───────────────────────────────── */}
        <Card className="p-6">
          <SectionHeader icon={Wallet} title="Capital Information" />
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FieldGroup>
                <Label htmlFor="fixedAssets">Fixed Assets / Dhaabbataa</Label>
                <Input id="fixedAssets" name="fixedAssets" type="number" min="0" step="0.01"
                  value={fixedAssets} onChange={(e) => setFixedAssets(e.target.value)} />
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="currentAssets">Current Assets / Socho&apos;aa</Label>
                <Input id="currentAssets" name="currentAssets" type="number" min="0" step="0.01"
                  value={currentAssets} onChange={(e) => setCurrentAssets(e.target.value)} />
              </FieldGroup>
            </div>

            <FieldGroup>
              <Label htmlFor="totalCapital">Total Capital (auto-calculated)</Label>
              <Input id="totalCapital" readOnly tabIndex={-1} aria-readonly="true"
                className="cursor-default bg-sand-100"
                value={totalCapital != null
                  ? totalCapital.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  : ""}
                placeholder="Calculated from fixed + current assets"
              />
            </FieldGroup>
          </div>
        </Card>

        {/* ── Section 6: Contact & Additional ──────────────────────────────── */}
        <Card className="p-6">
          <SectionHeader icon={Building2} title="Contact &amp; Additional Information" />
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FieldGroup>
                <Label htmlFor="contactPerson">Contact Person</Label>
                <Input id="contactPerson" name="contactPerson" defaultValue={cooperative?.contactPerson ?? ""} />
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="contactEmail">Contact Email</Label>
                <Input id="contactEmail" name="contactEmail" type="email" defaultValue={cooperative?.contactEmail ?? ""} />
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="contactPhone">Contact Phone</Label>
                <Input id="contactPhone" name="contactPhone" placeholder="+251 9XX XXX XXX" defaultValue={cooperative?.contactPhone ?? ""} />
              </FieldGroup>
            </div>
            <FieldGroup>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={3} defaultValue={cooperative?.description ?? ""} />
            </FieldGroup>
          </div>
        </Card>

        {/* ── Action Buttons ────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3 border-t border-ink-900/8 pt-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Saving…
              </span>
            ) : cooperative ? "Save changes" : "Create cooperative"}
          </Button>
          <Button type="reset" variant="outline">Reset</Button>
          <ButtonLink href="/cooperatives" variant="ghost">Cancel</ButtonLink>
        </div>
      </form>
    </div>
  );
}
