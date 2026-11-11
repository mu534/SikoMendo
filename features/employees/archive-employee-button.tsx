"use client";

import { useActionState } from "react";
import { archiveEmployee } from "@/features/employees/actions";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";

/**
 * Archive (soft-delete) button for an employee row on the employees list.
 *
 * Uses useActionState so that when the server action rejects the archive —
 * e.g. the employee is ACTIVE or ON_LEAVE and assertArchiveSafe throws
 * "X is currently {status}. Use the Lifecycle tab to initiate and complete
 * offboarding before archiving." — the returned error message is shown inline
 * beside the button instead of only being logged to the server terminal.
 *
 * ONBOARDING employees can be archived directly (cancelled hire scenario).
 */
export function ArchiveEmployeeButton({
  employeeId,
  confirmMessage,
  buttonLabel,
}: {
  employeeId: string;
  confirmMessage: string;
  buttonLabel: string;
}) {
  const action = archiveEmployee.bind(null, employeeId);
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction}>
      <ConfirmSubmitButton
        variant="ghost"
        size="sm"
        confirmMessage={confirmMessage}
        className="text-ink-900/40 hover:text-red-600"
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
