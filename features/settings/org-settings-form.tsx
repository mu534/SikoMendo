"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Camera, Trash2 } from "lucide-react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Input, Label, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { updateOrgSettings, removeOrgLogo } from "./actions";
import type { OrgSettings } from "./queries";
import type { ActionResult } from "@/lib/action-utils";

export function OrgSettingsForm({ settings }: { settings: OrgSettings }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState<ActionResult<null> | null, FormData>(
    updateOrgSettings,
    null
  );

  const [toast, setToast] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removePending, startRemoveTransition] = useTransition();
  const [removeError, setRemoveError] = useState<string | null>(null);

  useEffect(() => {
    if (state?.success) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToast("Organisation settings saved.");
      setPreview(null);
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [state]);

  const error = state && !state.success ? state.error.message : null;
  const currentLogo = preview ?? settings.logoUrl;

  function handleRemoveLogo() {
    if (!confirm("Remove the organisation logo? The default icon will be used instead.")) return;
    setRemoveError(null);
    startRemoveTransition(async () => {
      const result = await removeOrgLogo();
      if (!result.success) setRemoveError(result.error.message);
      else setPreview(null);
    });
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      {toast && (
        <div role="status" className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          {toast}
        </div>
      )}
      {(error || removeError) && (
        <div role="alert" className="flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
          <XCircle className="h-4 w-4 shrink-0 text-red-500" />
          {error ?? removeError}
        </div>
      )}

      {/* Logo */}
      <div>
        <Label>Organisation Logo</Label>
        <div className="mt-1.5 flex items-center gap-4">
          {/* Preview */}
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-ink-900/10 bg-sand-100">
            {currentLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentLogo} alt="Logo preview" className="h-full w-full object-contain" />
            ) : (
              <span className="text-2xl font-bold text-brand-700">
                {(settings.orgName[0] ?? "S").toUpperCase()}
              </span>
            )}
          </div>

          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-ink-900/15 bg-white px-3.5 py-2 text-sm font-medium text-ink-900 hover:bg-sand-100">
              <Camera className="h-4 w-4" />
              {currentLogo ? "Replace logo" : "Upload logo"}
              <input
                type="file"
                name="logo"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  setPreview(file ? URL.createObjectURL(file) : null);
                }}
              />
            </label>

            {settings.logoUrl && !preview && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={removePending}
                onClick={handleRemoveLogo}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove logo
              </Button>
            )}
          </div>
        </div>
        <p className="mt-1.5 text-xs text-ink-900/45">
          PNG, JPG, WEBP, or SVG. Recommended: square, min 64×64 px.
          Stored on Cloudinary.
        </p>
      </div>

      {/* Fields */}
      <FieldGroup>
        <Label htmlFor="orgName">Organisation name <span className="text-red-500">*</span></Label>
        <Input id="orgName" name="orgName" required defaultValue={settings.orgName} />
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="tagline">Tagline / System name <span className="text-red-500">*</span></Label>
        <Input id="tagline" name="tagline" required defaultValue={settings.tagline} />
        <p className="text-xs text-ink-900/45">
          Shown below the organisation name in the sidebar (e.g. "Union HRMIS").
        </p>
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="location">Location <span className="text-red-500">*</span></Label>
        <Input id="location" name="location" required defaultValue={settings.location} />
      </FieldGroup>

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
