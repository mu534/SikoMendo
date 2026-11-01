import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { LeaveStatusValue } from "./schemas";

const STATUS_TONE: Record<LeaveStatusValue, "neutral" | "brand" | "success" | "warning" | "danger"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
};

export function LeaveStatusBadge({ status }: { status: LeaveStatusValue }) {
  const t = useTranslations("leave");
  return <Badge tone={STATUS_TONE[status]}>{t(`statuses.${status}`)}</Badge>;
}
