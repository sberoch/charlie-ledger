import {
  EXPIRATION_URGENCY_LABELS,
  INVOICE_STATUS_LABELS,
  expirationState,
  todayIso,
  type InvoiceStatus,
} from "@workspace/shared"
import { Badge } from "@workspace/ui/components/badge"

/** License urgency pill — "7d left" / "Active" / "Expired" (CONTEXT.md bands). */
export function UrgencyPill({ endDate }: { endDate: string | null }) {
  const { urgency, daysLeft } = expirationState(endDate, todayIso())
  const variant = (
    {
      urgent: "urgent",
      expiring_soon: "warn",
      active: "active",
      expired: "expired",
    } as const
  )[urgency]
  const label =
    urgency === "urgent" || urgency === "expiring_soon"
      ? `${daysLeft}d left`
      : EXPIRATION_URGENCY_LABELS[urgency]
  return <Badge variant={variant}>{label}</Badge>
}

const INVOICE_VARIANTS: Record<
  InvoiceStatus,
  React.ComponentProps<typeof Badge>["variant"]
> = {
  paid: "active",
  unpaid: "default",
  overdue: "urgent",
  voided: "expired",
}

export function InvoiceStatusPill({ status }: { status: InvoiceStatus }) {
  return (
    <Badge variant={INVOICE_VARIANTS[status]}>
      {INVOICE_STATUS_LABELS[status]}
    </Badge>
  )
}
