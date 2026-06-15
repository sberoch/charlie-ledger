"use client"

import { useState } from "react"
import Link from "next/link"
import {
  formatInvoiceNumber,
  formatMoney,
  type InvoiceStatus,
} from "@workspace/shared"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { FilterChips } from "@/components/filter-chips"
import { InvoiceStatusPill } from "@/components/pills"
import { PageHeader } from "@/components/shell/page-header"
import { formatDate } from "@/lib/format"
import { useInvoices } from "./hooks"

const STATUS_OPTIONS: Array<{ value: InvoiceStatus; label: string }> = [
  { value: "unpaid", label: "Unpaid" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
  { value: "voided", label: "Voided" },
]

export function InvoicesPage() {
  const [status, setStatus] = useState<InvoiceStatus | null>(null)
  const [search, setSearch] = useState("")
  const { data: invoices, isPending } = useInvoices({
    status: status ?? undefined,
    search: search || undefined,
  })

  const receivable = invoices
    ?.filter((inv) => inv.status === "unpaid" || inv.status === "overdue")
    .reduce((acc, inv) => acc + Number(inv.amount), 0)

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle={
          invoices
            ? `${invoices.length} issued · ${formatMoney(String(receivable ?? 0))} outstanding`
            : "Loading…"
        }
      />

      <div className="mb-5 flex flex-col gap-3 border bg-card p-3.5 md:flex-row md:items-center md:gap-4">
        <FilterChips
          label="Status"
          options={STATUS_OPTIONS}
          value={status}
          onChange={setStatus}
        />
        <Input
          placeholder="Search number, source, or payer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="md:ml-auto md:max-w-56"
        />
      </div>

      {isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {invoices?.map((invoice) => (
            <li key={invoice.id}>
              <Link
                href={`/invoices/${invoice.id}`}
                className={cn(
                  "flex items-center gap-3 border bg-card p-3.5 transition-colors hover:bg-black/[0.015] md:gap-5",
                  invoice.status === "voided" && "opacity-55"
                )}
              >
                <span className="w-20 shrink-0 text-sm font-semibold tabular-nums md:w-24">
                  {formatInvoiceNumber(invoice.number)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">
                    {invoice.source.title}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] tracking-[0.04em] text-muted-foreground uppercase">
                    {invoice.billToName} · due {formatDate(invoice.dueDate)}
                  </span>
                </span>
                <span className="hidden text-sm font-semibold tabular-nums md:block">
                  {formatMoney(invoice.amount)}
                </span>
                <span className="flex flex-col items-end gap-1 md:contents">
                  <span className="text-sm font-semibold tabular-nums md:hidden">
                    {formatMoney(invoice.amount)}
                  </span>
                  <InvoiceStatusPill status={invoice.status} />
                </span>
              </Link>
            </li>
          ))}
          {invoices?.length === 0 ? (
            <li className="py-12 text-center text-sm text-muted-foreground">
              No invoices match. They are issued automatically with each license
              and demo.
            </li>
          ) : null}
        </ul>
      )}
    </div>
  )
}
