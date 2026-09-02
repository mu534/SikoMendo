"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ButtonVariant;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Standard client-mount detection (needed to avoid an SSR/client
    // mismatch) — there's no external signal to subscribe to here, this
    // *is* the mount signal.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true">
      <div
        className={cn(
          "absolute inset-0 bg-ink-900/40 backdrop-blur-[2px] transition-opacity duration-150",
          visible ? "opacity-100" : "opacity-0"
        )}
        onClick={onCancel}
      />
      <div
        className={cn(
          "relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-ink-900/5 transition-all duration-150",
          visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        )}
      >
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h3 className="font-display text-base font-semibold text-ink-900">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-900/60">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={variant} size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}