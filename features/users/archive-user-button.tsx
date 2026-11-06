"use client";

import { useActionState } from "react";
import { deleteUserAccount } from "@/features/users/actions";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";

/**
 * Soft-archive button for a user account row on the users list.
 *
 * Uses useActionState so that when the server action rejects the archive —
 * e.g. the target is an ADMIN account or the caller tries to archive their
 * own account — the returned error message is shown inline beside the
 * button instead of only being logged to the server terminal.
 *
 * The business rules themselves (ADMIN accounts can never be archived; you
 * cannot archive your own account) are unchanged; this only makes the
 * rejection visible to the user.
 */
export function ArchiveUserButton({
  userId,
  confirmMessage,
  confirmTitle,
  buttonLabel,
}: {
  userId: string;
  confirmMessage: string;
  confirmTitle: string;
  buttonLabel: string;
}) {
  const action = deleteUserAccount.bind(null, userId);
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction}>
      <ConfirmSubmitButton
        variant="danger"
        size="sm"
        confirmMessage={confirmMessage}
        confirmTitle={confirmTitle}
      >
        {buttonLabel}
      </ConfirmSubmitButton>
      {state && !state.success && (
        <p
          role="alert"
          className="ml-auto mt-1 max-w-[18rem] text-right text-xs text-red-600"
        >
          {state.error.message}
        </p>
      )}
    </form>
  );
}
