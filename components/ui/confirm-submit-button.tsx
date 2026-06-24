"use client";

import { useFormStatus } from "react-dom";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "@/components/ui/button";

/**
 * A submit button for Server Action forms that asks for confirmation
 * before destructive operations (delete, ban, deactivate) and shows a
 * pending state while the action runs.
 */
export function ConfirmSubmitButton({
  confirmMessage,
  variant = "danger",
  size = "sm",
  className,
  children,
  pendingLabel,
}: {
  confirmMessage: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: React.ReactNode;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={buttonClasses(variant, size, className)}
      onClick={(event) => {
        if (!confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {pending ? pendingLabel ?? "Working…" : children}
    </button>
  );
}
