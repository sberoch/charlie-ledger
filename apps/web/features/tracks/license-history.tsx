"use client"

import Link from "next/link"
import {
  EXCLUSIVITY_TIER_LABELS,
  USAGE_TYPE_LABELS,
  formatMoney,
  todayIso,
  type LicenseDto,
} from "@workspace/shared"
import { cn } from "@workspace/ui/lib/utils"
import { UrgencyPill } from "@/components/pills"
import { formatDate } from "@/lib/format"

/**
 * A track's licenses as a timeline: newest first, grouped by start year, each
 * usage on its own line with the media it grants. Live licenses get a filled
 * dot; expired ones are dimmed. Chosen over a table and a card list in the
 * prototype/license-history branch (Charlie's ask: show media type, separate
 * each usage clearly).
 */
export function LicenseHistory({ licenses }: { licenses: LicenseDto[] }) {
  if (licenses.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Never licensed yet.
      </p>
    )
  }

  const today = todayIso()
  const byYear = new Map<string, LicenseDto[]>()
  for (const l of [...licenses].sort((a, b) =>
    b.startDate.localeCompare(a.startDate)
  )) {
    const year = l.startDate.slice(0, 4)
    byYear.set(year, [...(byYear.get(year) ?? []), l])
  }

  return (
    <div className="flex flex-col gap-6">
      {[...byYear.entries()].map(([year, items]) => (
        <div key={year} className="grid grid-cols-[3.5rem_1fr] gap-x-4">
          <div className="font-heading text-lg tracking-tight text-muted-foreground">
            {year}
          </div>
          <ol className="flex flex-col border-l border-border pl-5">
            {items.map((l) => {
              const live = l.endDate === null || l.endDate >= today
              return (
                <li
                  key={l.id}
                  className="py-3 first:pt-0 last:pb-0"
                >
                  <Link
                    href={`/licenses/${l.id}`}
                    className={cn("group block", !live && "opacity-60")}
                  >
                    <div className="relative text-[11.5px] tracking-[0.1em] text-muted-foreground uppercase tabular-nums">
                      <span
                        aria-hidden
                        className={cn(
                          "absolute top-[5px] -left-[25px] size-2 rounded-full border bg-background",
                          live
                            ? "border-foreground bg-foreground"
                            : "border-border"
                        )}
                      />
                      {formatDate(l.startDate)} –{" "}
                      {l.endDate ? formatDate(l.endDate) : "Perpetual"}
                    </div>
                    <div className="mt-1 flex items-baseline justify-between gap-4">
                      <span className="text-[15px] font-semibold underline decoration-transparent underline-offset-3 group-hover:decoration-border">
                        {l.brandName}
                      </span>
                      <span className="shrink-0 text-[15px] font-semibold tabular-nums">
                        {formatMoney(l.fee)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-soft">
                      <span>
                        {l.usageTypes
                          .map((u) => USAGE_TYPE_LABELS[u])
                          .join(" · ")}
                      </span>
                      <span className="text-muted-foreground">
                        — {EXCLUSIVITY_TIER_LABELS[l.exclusivityTier]}
                      </span>
                      <UrgencyPill endDate={l.endDate} />
                    </div>
                  </Link>
                </li>
              )
            })}
          </ol>
        </div>
      ))}
    </div>
  )
}
