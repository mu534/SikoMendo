import { Badge } from "@/components/ui/badge";
import { LEAVE_STATUS_LABELS, type LeaveStatusValue } from "./schemas";

const STATUS_TONE: Record<LeaveStatusValue, "neutral" | "brand" | "success" | "warning" | "danger"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
};

export function LeaveStatusBadge({ status }: { status: LeaveStatusValue }) {
  return <Badge tone={STATUS_TONE[status]}>{LEAVE_STATUS_LABELS[status]}</Badge>;
}
