"use client";

import { useActionState, useState } from "react";
import { Textarea, Label, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { decideLeaveRequest } from "./actions";

type ActionState = { success: true; data: { id: string } } | { success: false; error: { message: string } } | null;

export function LeaveDecisionForm({ id }: { id: string }) {
  const action = decideLeaveRequest.bind(null, id);
  const [state, formAction, isPending] = useActionState(action, null);
  const typedState = state as ActionState;

  const [showRejectReason, setShowRejectReason] = useState(false);

  const errorMessage = typedState && typedState.success === false ? typedState.error.message : null;

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-ink-900/8 bg-sand-50 p-5">
      <p className="text-sm font-medium text-ink-900">Decision</p>

      {errorMessage && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
          {errorMessage}
        </div>
      )}

      {showRejectReason && (
        <FieldGroup>
          <Label htmlFor="rejectionReason">Rejection Reason</Label>
          <Textarea
            id="rejectionReason"
            name="rejectionReason"
            rows={3}
            required
            placeholder="Explain why this request is being rejected."
          />
        </FieldGroup>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {!showRejectReason ? (
          <>
            <Button
              type="submit"
              name="decision"
              value="APPROVED"
              variant="primary"
              disabled={isPending}
            >
              {isPending ? "Approving…" : "Approve"}
            </Button>
            <Button type="button" variant="danger" onClick={() => setShowRejectReason(true)}>
              Reject
            </Button>
          </>
        ) : (
          <>
            <Button type="submit" name="decision" value="REJECTED" variant="danger" disabled={isPending}>
              {isPending ? "Rejecting…" : "Confirm Rejection"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowRejectReason(false)}>
              Back
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
