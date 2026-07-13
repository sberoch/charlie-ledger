"use client"

import { useMemo } from "react"
import { formatMoney, todayIso, type RoyaltyPaymentDto } from "@workspace/shared"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { PageHeader } from "@/components/shell/page-header"
import { useRoyalties } from "./hooks"
import { RoyaltyComposer } from "./royalty-composer"
import { RoyaltyRow } from "./royalty-row"

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
  items: RoyaltyPaymentDto[]
  subtotal: number
}

export function RoyaltiesPage() {
  const { data: royalties, isPending } = useRoyalties()

  // The API returns payments newest-first, so Map insertion order already
  // yields months newest-first and rows within each month newest-first.
  const groups = useMemo<MonthGroup[]>(() => {
    const map = new Map<string, RoyaltyPaymentDto[]>()
    for (const royalty of royalties ?? []) {
      const ym = royalty.date.slice(0, 7)
      const bucket = map.get(ym)
      if (bucket) bucket.push(royalty)
      else map.set(ym, [royalty])
    }
    return [...map.entries()].map(([ym, items]) => ({
      ym,
      label: monthLabel(ym),
      items,
      subtotal: roundCents(items.reduce((s, r) => s + Number(r.amount), 0)),
    }))
  }, [royalties])

  const year = todayIso().slice(0, 4)
  const yearTotal = roundCents(
    (royalties ?? [])
      .filter((r) => r.date.startsWith(year))
      .reduce((s, r) => s + Number(r.amount), 0)
  )

  return (
    <div>
      <PageHeader
        title="Royalties"
        subtitle={
          royalties
            ? `Royalty income received — BMI, AFM, SAG and friends. ${formatMoney(String(yearTotal))} this year.`
            : "Loading…"
        }
      />

      <div className="mb-6">
        <RoyaltyComposer mode="create" />
      </div>

      {isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No royalty payments yet. Add your first one above.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <section key={group.ym}>
              <div className="mb-2 flex items-baseline justify-between border-b pb-1.5">
                <h2 className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  {group.label}
                </h2>
                <span className="text-sm font-semibold tabular-nums">
                  {formatMoney(String(group.subtotal))}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {group.items.map((royalty) => (
                  <RoyaltyRow key={royalty.id} royalty={royalty} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
