"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/**
 * A submit button for Server Action forms that shows a styled confirmation
 * dialog before destructive operations (delete, ban, deactivate, archive)
 * and a pending state while the action runs.
 */
export function ConfirmSubmitButton({
  confirmMessage,
  confirmTitle = "Are you sure?",
  confirmLabel,
  variant = "danger",
  size = "sm",
  className,
  children,
  pendingLabel,
}: {
  confirmMessage: string;
  confirmTitle?: string;
  confirmLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: React.ReactNode;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  return (
    <>
      <button
        type="button"
        disabled={pending}
        className={buttonClasses(variant, size, className)}
        onClick={(event) => {
          formRef.current = event.currentTarget.form;
          setOpen(true);
        }}
      >
        {pending ? pendingLabel ?? "Working…" : children}
      </button>

      {open && (
        <ConfirmDialog
          title={confirmTitle}
          message={confirmMessage}
          confirmLabel={confirmLabel ?? (typeof children === "string" ? children : "Confirm")}
          variant={variant}
          onCancel={() => setOpen(false)}
          onConfirm={() => {
            setOpen(false);
            formRef.current?.requestSubmit();
          }}
        />
      )}
    </>
  );
}