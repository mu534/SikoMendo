"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Input, Label, Select, Textarea, FieldGroup, FieldError } from "@/components/ui/field";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { submitLeaveRequest } from "./actions";
import { LEAVE_TYPES, LEAVE_TYPE_LABELS } from "./schemas";
import type { LeaveBalanceEntry } from "./queries";

type ActionState = { success: true; data: { id: string } } | { success: false; error: { message: string } } | null;

function calculateTotalDays(start: string, end: string): number | null {
  if (!start || !end) return null;
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  const diff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? diff : null;
}

export function LeaveRequestForm({ balances = [] }: { balances?: LeaveBalanceEntry[] }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(submitLeaveRequest, null);
  const typedState = state as ActionState;

  const [leaveType, setLeaveType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const totalDays = useMemo(() => calculateTotalDays(startDate, endDate), [startDate, endDate]);
  const selectedBalance = useMemo(
    () => balances.find((b) => b.leaveType === leaveType) ?? null,
    [balances, leaveType]
  );

  useEffect(() => {
    if (typedState?.success) {
      router.push("/leave");
      router.refresh();
    }
  }, [typedState, router]);

  const errorMessage = typedState && typedState.success === false ? typedState.error.message : null;

  return (
    <Card className="max-w-2xl p-6">
      <form action={formAction} className="space-y-5">
        {errorMessage && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
            {errorMessage}
          </div>
        )}

        <FieldGroup>
          <Label htmlFor="leaveType">Leave Type</Label>
          <Select
            id="leaveType"
            name="leaveType"
            required
            value={leaveType}
            onChange={(e) => setLeaveType(e.target.value)}
          >
            <option value="" disabled>
              Select a leave type…
            </option>
            {LEAVE_TYPES.map((type) => (
              <option key={type} value={type}>
                {LEAVE_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
          {selectedBalance && (
            <p className="mt-1.5 text-xs text-ink-900/50">
              {selectedBalance.remaining === null
                ? "No yearly cap for this leave type."
                : `${selectedBalance.remaining} of ${selectedBalance.entitled} day(s) remaining this year.`}
            </p>
          )}
        </FieldGroup>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              name="startDate"
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              name="endDate"
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </FieldGroup>
        </div>

        <div className="rounded-lg bg-sand-100 px-4 py-3 text-sm text-ink-900/70">
          Total days requested:{" "}
          <span className="font-semibold text-ink-900">{totalDays ?? "—"}</span>
        </div>
        {startDate && endDate && totalDays === null && (
          <FieldError>Start date cannot be after end date.</FieldError>
        )}

        <FieldGroup>
          <Label htmlFor="reason">Reason</Label>
          <Textarea id="reason" name="reason" rows={4} required placeholder="Briefly explain the reason for your leave request." />
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="document">Supporting Document (optional)</Label>
          <input id="document" name="document" type="file" className="block text-sm" />
        </FieldGroup>

        <div className="flex items-center gap-3 border-t border-ink-900/8 pt-5">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Submitting…" : "Submit Request"}
          </Button>
          <ButtonLink href="/leave" variant="ghost">
            Cancel
          </ButtonLink>
        </div>
      </form>
    </Card>
  );
}
