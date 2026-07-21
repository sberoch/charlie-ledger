"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ReportResultSchema, formatMoney } from "@workspace/shared"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { InvoiceStatusPill } from "@/components/pills"
import { api } from "@/lib/api"
import { formatDate } from "@/lib/format"
import { useInvoices } from "@/features/invoices/hooks"

/**
 * Month-income breakdown, opened from the Earnings month box. A thin renderer
 * of the SAME Report pull the Reports page uses (commitment basis, one row per
 * live invoice) — one income engine, two presentations, so the dialog's total
 * reconciles with the clicked box to the cent, royalties included.
 */
export function MonthIncomeDialog({
  open,
  onOpenChange,
  from,
  to,
  label,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  from: string
  to: string
  label: string
}) {
  const query = {
    from,
    to,
    groupBy: "invoice" as const,
    basis: "commitment" as const,
    includeLeads: false,
  }
  const { data: report, isPending } = useQuery({
    queryKey: ["reports", query],
    queryFn: () => api("/reports/sales", { query, schema: ReportResultSchema }),
    enabled: open,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] gap-0 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl tracking-tight">
            {label} · Income
          </DialogTitle>
        </DialogHeader>
        {isPending || !report ? (
          <Skeleton className="mt-4 h-40" />
        ) : (
          <div className="mt-4">
            <div className="flex flex-col">
              {report.rows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-baseline justify-between gap-3 border-b border-border-soft py-2 text-[13px] last:border-0"
                >
                  <span className="min-w-0 truncate">{row.label}</span>
                  <span className="font-semibold tabular-nums">
                    {formatMoney(row.total)}
                  </span>
                </div>
              ))}
              {report.rows.length === 0 ? (
                <p className="py-3 text-sm text-muted-foreground">
                  No invoices issued this month.
                </p>
              ) : null}
            </div>
            <div className="mt-2 flex items-baseline justify-between border-t border-foreground pt-2.5">
              <span className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
                Sales · {report.invoiceCount} invoices
              </span>
              <span className="font-semibold tabular-nums">
                {formatMoney(report.grandTotal)}
              </span>
            </div>

            {report.royaltyRows.length > 0 ? (
              <>
                <div className="mt-5 flex flex-col">
                  {report.royaltyRows.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-baseline justify-between gap-3 border-b border-border-soft py-2 text-[13px] last:border-0"
                    >
                      <span className="min-w-0 truncate">
                        {row.label}
                        <span className="ml-1.5 text-[11px] text-muted-foreground">
                          ×{row.paymentCount}
                        </span>
                      </span>
                      <span className="font-semibold tabular-nums">
                        {formatMoney(row.total)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-baseline justify-between border-t border-foreground pt-2.5">
                  <span className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
                    Royalties · {report.royaltyPaymentCount} payments
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatMoney(report.royaltyTotal)}
                  </span>
                </div>
              </>
            ) : null}

            <div className="mt-5 flex items-baseline justify-between border border-foreground bg-card px-3 py-2.5">
              <span className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
                Total income
              </span>
              <span className="font-heading text-lg tracking-tight">
                {formatMoney(report.totalIncome)}
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Receivables list, opened from the unpaid-invoices footer. Deliberately fed
 * by the invoices list, NOT the Report — "unpaid" is an invoice-lifecycle
 * concept the Report has no dimension for (ADR-0012 names this dashboard
 * figure as the unpaid surface). All-time, matching the box; overdue first.
 * Rows are a pure lens — mark-paid and void live on the invoice detail page.
 */
export function UnpaidInvoicesDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: invoices, isPending } = useInvoices()
  const unpaid = (invoices ?? [])
    .filter((inv) => inv.status === "unpaid" || inv.status === "overdue")
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "overdue" ? -1 : 1
      return a.dueDate < b.dueDate ? -1 : 1
    })
  const total = unpaid.reduce((acc, inv) => acc + Number(inv.amount), 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] gap-0 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl tracking-tight">
            Unpaid Invoices
          </DialogTitle>
        </DialogHeader>
        {isPending ? (
          <Skeleton className="mt-4 h-40" />
        ) : (
          <div className="mt-4">
            <div className="flex flex-col">
              {unpaid.map((inv) => (
                <Link
                  key={inv.id}
                  href={`/invoices/${inv.id}`}
                  className="flex items-center gap-3 border-b border-border-soft py-2.5 last:border-0 hover:bg-black/[0.02]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">
                      {inv.source.title}
                    </span>
                    <span className="mt-0.5 block text-[11px] tracking-[0.04em] text-muted-foreground uppercase">
                      issued {formatDate(inv.issueDate)} · due{" "}
                      {formatDate(inv.dueDate)}
                    </span>
                  </span>
                  <InvoiceStatusPill status={inv.status} />
                  <span className="w-20 text-right text-[13px] font-semibold tabular-nums">
                    {formatMoney(inv.amount)}
                  </span>
                </Link>
              ))}
              {unpaid.length === 0 ? (
                <p className="py-3 text-sm text-muted-foreground">
                  Nothing outstanding — every live invoice is paid.
                </p>
              ) : null}
            </div>
            {unpaid.length > 0 ? (
              <div className="mt-2 flex items-baseline justify-between border-t border-foreground pt-2.5">
                <span className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
                  Outstanding · {unpaid.length} invoices
                </span>
                <span className="font-heading text-lg tracking-tight">
                  {formatMoney(total.toFixed(2))}
                </span>
              </div>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
