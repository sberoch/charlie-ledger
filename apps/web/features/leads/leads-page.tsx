"use client"

import { useMemo } from "react"
import { formatMoney, todayIso, type LeadDto } from "@workspace/shared"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { PageHeader } from "@/components/shell/page-header"
import { useLeads } from "./hooks"
import { LeadComposer } from "./lead-composer"
import { LeadRow } from "./lead-row"

/** "2026-06" → "June 2026". */
function monthLabel(ym: string): string {
  return new Date(`${ym}-01T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })
}

function roundCents(n: number): number {
  return Math.round(n * 100) / 100
}

interface MonthGroup {
  ym: string
  label: string
  items: LeadDto[]
  subtotal: number
}

export function LeadsPage() {
  const { data: leads, isPending } = useLeads()

  // The API returns leads newest-first, so Map insertion order already yields
  // months newest-first and rows within each month newest-first.
  const groups = useMemo<MonthGroup[]>(() => {
    const map = new Map<string, LeadDto[]>()
    for (const lead of leads ?? []) {
      const ym = lead.date.slice(0, 7)
      const bucket = map.get(ym)
      if (bucket) bucket.push(lead)
      else map.set(ym, [lead])
    }
    return [...map.entries()].map(([ym, items]) => ({
      ym,
      label: monthLabel(ym),
      items,
      subtotal: roundCents(items.reduce((s, l) => s + Number(l.amount), 0)),
    }))
  }, [leads])

  const year = todayIso().slice(0, 4)
  const yearTotal = roundCents(
    (leads ?? [])
      .filter((l) => l.date.startsWith(year))
      .reduce((s, l) => s + Number(l.amount), 0)
  )

  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle={
          leads
            ? "Private record. Milestone payments or your own monthly splits. Not tied to invoices or sales."
            : "Loading…"
        }
      />

      <div className="mb-6">
        <LeadComposer mode="create" />
      </div>

      {isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No leads yet. Add your first one above.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <section key={group.ym}>
              <div className="mb-2 flex items-baseline justify-between border-b pb-1.5">
                <h2 className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  {group.label}
                </h2>
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    group.subtotal < 0 && "text-rust"
                  )}
                >
                  {formatMoney(String(group.subtotal))}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {group.items.map((lead) => (
                  <LeadRow key={lead.id} lead={lead} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
