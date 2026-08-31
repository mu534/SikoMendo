import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getSignedFileUrl } from "@/lib/cloudinary";
import prisma from "@/lib/prisma";
import { getLeaveRequestById } from "@/features/leave/queries";
import { LeaveStatusBadge } from "@/features/leave/leave-status-badge";
import { LeaveDecisionForm } from "@/features/leave/leave-decision-form";
import { cancelLeaveRequest } from "@/features/leave/actions";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { LEAVE_TYPE_LABELS } from "@/features/leave/schemas";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";

export default async function LeaveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;

  const leave = await getLeaveRequestById(id);
  if (!leave) notFound();

  const isOwner = leave.employee.userId === session.user.id;
  let canViewAll = can(session.user.role, "VIEW_ALL_LEAVE");

  // A Manager's "view all" is scoped to their own team (matching the leave
  // list), not the whole org — viewing someone else's request directly by
  // URL shouldn't be possible just because they're a manager somewhere else.
  if (canViewAll && session.user.role === "MANAGER") {
    const managerEmployee = await prisma.employee.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    canViewAll = !!managerEmployee && leave.employee.managerId === managerEmployee.id;
  }

  const canDecide = can(session.user.role, "MANAGE_LEAVE") && canViewAll;

  if (!isOwner && !canViewAll) {
    redirect("/leave");
  }

  const canCancel = isOwner && leave.status === "PENDING";
  const canShowDecisionForm = canDecide && leave.status === "PENDING";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/leave" className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Back to leave requests
          </Link>
          <h2 className="font-display text-xl font-semibold text-ink-900">{leave.leaveId}</h2>
        </div>
        <LeaveStatusBadge status={leave.status} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Request details" />
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 p-6 sm:grid-cols-2">
              <Field label="Employee">
                <div className="flex items-center gap-3">
                  <Avatar name={`${leave.employee.firstName} ${leave.employee.lastName}`} imageUrl={leave.employee.profileImageUrl} size="sm" />
                  <div>
                    <p className="font-medium text-ink-900">
                      {leave.employee.firstName} {leave.employee.lastName}
                    </p>
                    <p className="text-xs text-ink-900/50">{leave.employee.employeeId}</p>
                  </div>
                </div>
              </Field>
              <Field label="Leave Type">{LEAVE_TYPE_LABELS[leave.leaveType]}</Field>
              <Field label="Start Date">{formatDate(leave.startDate)}</Field>
              <Field label="End Date">{formatDate(leave.endDate)}</Field>
              <Field label="Total Days">{leave.totalDays}</Field>
              <Field label="Applied Date">{formatDate(leave.appliedDate)}</Field>
              <Field label="Reason" full>
                <p className="whitespace-pre-wrap text-sm text-ink-900/80">{leave.reason}</p>
              </Field>
              {leave.documentUrl && (
                <Field label="Supporting Document" full>
                  <a
                    href={
                      leave.documentKey
                        ? getSignedFileUrl(leave.documentKey, leave.documentResourceType === "image" ? "image" : "raw")
                        : leave.documentUrl
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    View document
                  </a>
                </Field>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Decision" />
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 p-6 sm:grid-cols-2">
              <Field label="Status">
                <LeaveStatusBadge status={leave.status} />
              </Field>
              <Field label="Decision Date">{leave.decisionDate ? formatDate(leave.decisionDate) : "—"}</Field>
              <Field label="Approver">{leave.approver?.name ?? "—"}</Field>
              {leave.status === "REJECTED" && (
                <Field label="Rejection Reason" full>
                  <p className="whitespace-pre-wrap text-sm text-ink-900/80">{leave.rejectionReason}</p>
                </Field>
              )}
              <Field label="Created At">{formatDateTime(leave.createdAt)}</Field>
              <Field label="Updated At">{formatDateTime(leave.updatedAt)}</Field>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {canShowDecisionForm && <LeaveDecisionForm id={leave.id} />}
          {canCancel && (
            <Card className="p-6">
              <p className="mb-3 text-sm text-ink-900/60">
                This request is still pending. You can cancel it any time before it&apos;s decided.
              </p>
              <form
                action={async () => {
                  "use server";
                  await cancelLeaveRequest(leave.id);
                }}
              >
                <ConfirmSubmitButton confirmMessage="Cancel this leave request?" variant="danger">
                  Cancel Request
                </ConfirmSubmitButton>
              </form>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-900/40">{label}</p>
      <div className="mt-1 text-sm text-ink-900/80">{children}</div>
    </div>
  );
}
