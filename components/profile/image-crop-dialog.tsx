"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { useTranslations } from "next-intl";
import { Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCroppedImg, type CroppedAreaPixels } from "@/lib/crop-utils";
import { cn } from "@/lib/utils";

// ── Props ──────────────────────────────────────────────────────────────────────

interface ImageCropDialogProps {
  open: boolean;
  /** Object URL of the selected (and EXIF-corrected) file. */
  imageSrc: string;
  onCancel: () => void;
  /** Called with the 512×512 JPEG blob when the user confirms the crop. */
  onSave: (croppedBlob: Blob) => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ImageCropDialog({ open, imageSrc, onCancel, onSave }: ImageCropDialogProps) {
  const t = useTranslations("profile");
  const tC = useTranslations("common");

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CroppedAreaPixels | null>(null);
  const [processing, setProcessing] = useState(false);

  const titleId = "crop-dialog-title";
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // Reset crop/zoom when a new image is loaded
  useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setProcessing(false);
      // Move focus to the Cancel button when the dialog opens
      requestAnimationFrame(() => cancelBtnRef.current?.focus());
    }
  }, [open, imageSrc]);

  // Dismiss on Escape key
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  const handleCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels as CroppedAreaPixels);
  }, []);

  async function handleSave() {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
      onSave(blob);
    } catch (err) {
      console.error("Crop failed:", err);
    } finally {
      setProcessing(false);
    }
  }

  if (!open) return null;

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      {/* Dialog panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="border-b border-ink-900/8 px-5 py-4">
          <h2 id={titleId} className="font-display text-base font-semibold text-ink-900">
            {t("cropYourPhoto")}
          </h2>
        </div>

        {/* Crop area — fixed height */}
        <div className="relative h-72 bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
          />
        </div>

        {/* Zoom control */}
        <div className="border-t border-ink-900/8 px-5 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={t("zoomOut")}
              onClick={() => setZoom((z) => Math.max(1, +(z - 0.1).toFixed(1)))}
              disabled={zoom <= 1}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-ink-900/15 text-ink-900/60 hover:bg-sand-100 disabled:opacity-40"
            >
              <ZoomOut className="h-4 w-4" />
            </button>

            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              aria-label={`${t("zoomIn")} / ${t("zoomOut")}`}
              onChange={(e) => setZoom(Number(e.target.value))}
              className={cn(
                "h-1.5 w-full cursor-pointer appearance-none rounded-full",
                "bg-brand-100 accent-brand-700"
              )}
            />

            <button
              type="button"
              aria-label={t("zoomIn")}
              onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(1)))}
              disabled={zoom >= 3}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-ink-900/15 text-ink-900/60 hover:bg-sand-100 disabled:opacity-40"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t border-ink-900/8 px-5 py-4">
          <Button
            ref={cancelBtnRef}
            type="button"
            variant="ghost"
            size="md"
            onClick={onCancel}
            disabled={processing}
          >
            {tC("cancel")}
          </Button>
          <Button
            type="button"
            size="md"
            onClick={handleSave}
            disabled={processing || !croppedAreaPixels}
          >
            {processing ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("uploading")}
              </span>
            ) : (
              t("savePhoto")
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
