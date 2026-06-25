"use client";

import { useActionState } from "react";
import { CheckCheck } from "lucide-react";
import { markUnmarkedPresent } from "./actions";
import { Button } from "@/components/ui/button";

export function MarkAllPresentButton({ date, employeeIds }: { date: string; employeeIds: string[] }) {
  const action = markUnmarkedPresent.bind(null, date, employeeIds);
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <form action={formAction}>
      <Button type="submit" variant="outline" disabled={isPending || employeeIds.length === 0}>
        <CheckCheck className="h-4 w-4" />
        {isPending ? "Marking…" : "Mark unmarked as present"}
      </Button>
      {state && !state.success && <p className="mt-1 text-xs text-red-600">{state.error.message}</p>}
    </form>
  );
}
