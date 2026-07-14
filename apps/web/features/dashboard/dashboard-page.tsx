"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { USAGE_TYPE_LABELS, formatMoney } from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { Panel, PanelLink } from "@/components/panel"
import { useSession } from "@/lib/auth-client"
import { formatDate, formatTimestamp } from "@/lib/format"
import { useConvertDemo } from "@/features/demos/hooks"
import { useDashboard } from "./hooks"
import { TimelinePanel } from "./timeline-panel"

const DONUT_COLORS = ["#1a1a1a", "#4a4a4a", "#7a7670", "#a8a39a", "#c4bfb5"]

function ReadyDemoRow({
  demo,
}: {
  demo: {
    id: string
    workingName: string
    brandName: string
    holdEndsAt: string
    fee: string
  }
}) {
  const convert = useConvertDemo(demo.id)
  return (
    <div className="flex items-center gap-3 border-b border-border-soft py-3 last:border-0">
      <Link href={`/demos/${demo.id}`} className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">
          {demo.workingName}
        </span>
        <span className="mt-0.5 block text-[11px] tracking-[0.05em] text-muted-foreground uppercase">
          for {demo.brandName} · lifted {formatDate(demo.holdEndsAt)}
        </span>
      </Link>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={convert.isPending}
        onClick={() =>
          convert
            .mutateAsync({})
            .then(() => toast.success(`${demo.workingName} converted`))
            .catch((e) => toast.error(e.message))
        }
      >
        Convert
      </Button>
    </div>
  )
}

function EarningsStat({
  label,
  value,
  muted,
}: {
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div>
      <div className="text-[11px] tracking-[0.05em] text-muted-foreground uppercase">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 font-heading tracking-tight",
          muted ? "text-lg text-ink-soft" : "text-2xl"
        )}
      >
        {formatMoney(value)}
      </div>
    </div>
  )
}

function EarningsPanel({
  earnings,
}: {
  earnings: {
    monthToDate: string
    lastYearMonth: string
    yearToDate: string
    lastYearToDate: string
    unpaid: {
      amount: string
      count: number
      overdueAmount: string
      overdueCount: number
    }
  }
}) {
  const now = new Date()
  const month = now.toLocaleDateString("en-US", { month: "long" })
  const year = now.getFullYear()
  const lastYear = year - 1
  return (
    // First card on desktop, but below the timeline in the mobile scroll
    // order — DOM order serves mobile; flex order flips it on lg.
    <Panel title="Earnings" className="lg:order-first">
      {/* Commitment basis (CONTEXT.md "Earnings"): live invoices by issue date
          + royalties by their date. Left column is this year; right column is
          the year-ago comparator — the month compares against the FULL prior
          month, YTD against the same-date cutoff. */}
      <div className="grid grid-cols-2 gap-x-5 gap-y-4">
        <EarningsStat
          label={`${month} ${year}`}
          value={earnings.monthToDate}
        />
        <EarningsStat
          label={`${month} ${lastYear}`}
          value={earnings.lastYearMonth}
          muted
        />
        <EarningsStat label={`${year} to date`} value={earnings.yearToDate} />
        <EarningsStat
          label={`${lastYear} to date`}
          value={earnings.lastYearToDate}
          muted
        />
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-border-soft pt-3.5">
        <span className="text-[11px] tracking-[0.05em] text-muted-foreground uppercase">
          Unpaid invoices · {earnings.unpaid.count}
          {earnings.unpaid.overdueCount > 0 ? (
            <span className="text-rust">
              {" "}
              · {formatMoney(earnings.unpaid.overdueAmount)} overdue
            </span>
          ) : null}
        </span>
        <span className="font-heading text-xl tracking-tight">
          {formatMoney(earnings.unpaid.amount)}
        </span>
      </div>
    </Panel>
  )
}

function TagTrendRows({
  rows,
}: {
  rows: Array<{
    tag: string
    total: string
    licenseCount: number
    brands: Array<{ brandName: string; amount: string }>
  }>
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const max = Math.max(1, ...rows.map((r) => Number(r.total)))
  return (
    <div className="flex flex-col gap-3.5">
      {rows.map((row) => {
        const key = row.tag
        const open = expanded === key
        return (
          <div key={key} className="text-[12.5px]">
            <button
              type="button"
              className="block w-full cursor-pointer text-left"
              onClick={() => setExpanded(open ? null : key)}
            >
              <span className="mb-1 flex justify-between gap-2">
                <span className="truncate tracking-[0.02em]">
                  {row.tag}
                  <span className="ml-1.5 text-[11px] text-muted-foreground">
                    ×{row.licenseCount}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">
                  {formatMoney(row.total)}
                </span>
              </span>
              <span className="block h-2 border bg-secondary">
                <span
                  className="block h-full bg-primary"
                  style={{ width: `${(Number(row.total) / max) * 100}%` }}
                />
              </span>
            </button>
            {open ? (
              <div className="mt-1.5 flex flex-col gap-0.5 border-l-2 border-border pl-3 text-[11.5px] text-ink-soft">
                {row.brands.map((b) => (
                  <span key={b.brandName} className="flex justify-between">
                    {b.brandName}
                    <span className="tabular-nums">
                      {formatMoney(b.amount)}
                    </span>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        )
      })}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No licensed tags yet.</p>
      ) : null}
    </div>
  )
}

export function DashboardPage() {
  const { data: session } = useSession()
  const { data, isPending } = useDashboard()

  const now = new Date()
  const hour = now.getHours()
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
  const firstName = session?.user.name?.split(" ")[0] ?? ""

  if (isPending || !data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-96" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  return (
    <div>
      <header className="mb-6 flex flex-col gap-3 border-b pb-5 md:mb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-heading text-[26px] leading-none tracking-tight md:text-[32px]">
            {now.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </h1>
          <div className="mt-2.5 text-xs tracking-[0.1em] text-muted-foreground uppercase">
            {greeting}
            {firstName ? `, ${firstName}` : ""}
          </div>
        </div>
        <div className="text-[12.5px] text-muted-foreground md:text-right">
          <strong className="font-semibold text-foreground">
            {data.summary.trackCount}
          </strong>{" "}
          tracks ·{" "}
          <strong className="font-semibold text-foreground">
            {data.summary.activeLicenseCount}
          </strong>{" "}
          active licenses ·{" "}
          <strong
            className={cn(
              "font-semibold",
              data.summary.expiringThisWeekCount > 0
                ? "text-rust"
                : "text-foreground"
            )}
          >
            {data.summary.expiringThisWeekCount}
          </strong>{" "}
          expiring this week
        </div>
      </header>

      {/* Locked mobile scroll order; reflows to the prototype's 2-col grid on lg. */}
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="flex flex-col gap-5 lg:sticky lg:top-8">
          <TimelinePanel timeline={data.timeline} atRisk={data.atRisk} />
          <EarningsPanel earnings={data.earnings} />
        </div>

        <div className="flex flex-col gap-5">
          <Panel title="License Mix · By Usage">
            {/* A license can grant several media, so its fee counts toward each.
                `share` is normalised against the usage-weighted total (not
                revenue), so the slices partition to 100% and read as a true
                usage mix — see ADR-0004. */}
            <div className="flex items-center gap-5">
              <svg viewBox="0 0 42 42" className="size-24 shrink-0 md:size-28">
                <circle
                  cx="21"
                  cy="21"
                  r="15.9155"
                  fill="transparent"
                  stroke="#e3e0d8"
                  strokeWidth="6"
                />
                {data.licenseMix.map((slice, i) => {
                  const pct = slice.share * 100
                  const offset =
                    25 -
                    data.licenseMix
                      .slice(0, i)
                      .reduce((sum, s) => sum + s.share * 100, 0)
                  return (
                    <circle
                      key={slice.usageType}
                      cx="21"
                      cy="21"
                      r="15.9155"
                      fill="transparent"
                      stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
                      strokeWidth="6"
                      strokeDasharray={`${pct} ${100 - pct}`}
                      strokeDashoffset={offset}
                      transform="rotate(-90 21 21)"
                    />
                  )
                })}
              </svg>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                {data.licenseMix.map((slice, i) => (
                  <div
                    key={slice.usageType}
                    className="grid grid-cols-[12px_1fr_auto] items-center gap-2.5 text-[12.5px]"
                  >
                    <span
                      className="size-[11px]"
                      style={{
                        background: DONUT_COLORS[i % DONUT_COLORS.length],
                      }}
                    />
                    <span className="truncate">
                      {USAGE_TYPE_LABELS[slice.usageType]}
                    </span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {Math.round(slice.share * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel title="Tag Trend · What Styles Sell">
            <TagTrendRows rows={data.tagTrend} />
          </Panel>

          {data.readyDemos.length > 0 ? (
            <Panel
              title="Ready to Reuse · Holds Lifted"
              action={<PanelLink href="/demos">All demos →</PanelLink>}
            >
              <div className="flex flex-col">
                {data.readyDemos.map((demo) => (
                  <ReadyDemoRow key={demo.id} demo={demo} />
                ))}
              </div>
            </Panel>
          ) : null}

          <Panel title="Demo Income">
            <div className="flex items-end justify-between gap-3">
              <div className="font-heading text-3xl tracking-tight">
                {formatMoney(data.demoIncome.total)}
              </div>
              <div className="pb-1 text-[11px] tracking-[0.04em] text-muted-foreground">
                {data.demoIncome.openCount} open ·{" "}
                {data.demoIncome.convertedCount} converted
              </div>
            </div>
          </Panel>

          <Panel
            title="Royalty Income"
            action={<PanelLink href="/royalties">All royalties →</PanelLink>}
          >
            <div className="flex items-end justify-between gap-3">
              <div className="font-heading text-3xl tracking-tight">
                {formatMoney(data.royaltyIncome.total)}
              </div>
              <div className="pb-1 text-[11px] tracking-[0.04em] text-muted-foreground">
                {data.royaltyIncome.paymentCount} payments received
              </div>
            </div>
          </Panel>

          <Panel
            title="Top Earning Tracks · Lifetime"
            action={<PanelLink href="/tracks">View all →</PanelLink>}
          >
            <div className="flex flex-col">
              {data.topTracks.map((track, i) => (
                <Link
                  key={track.trackId}
                  href={`/tracks/${track.trackId}`}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-border-soft py-2.5 last:border-0 hover:bg-black/[0.02]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold">
                      {track.name}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {track.licenseCount} licenses · {track.tags.join(", ")}
                    </span>
                  </span>
                  <span className="text-[13.5px] font-semibold tabular-nums">
                    {formatMoney(track.lifetimeSales)}
                  </span>
                </Link>
              ))}
            </div>
          </Panel>

          <Panel title="Recent Activity">
            <div className="flex flex-col">
              {data.activity.map((item, i) => (
                <div
                  key={`${item.kind}-${item.sourceId}-${i}`}
                  className="flex items-start justify-between gap-3 border-b border-border-soft py-2.5 text-[13px] last:border-0"
                >
                  <span className="min-w-0">
                    <span className="block truncate">{item.title}</span>
                    <span className="mt-0.5 block text-[11px] tracking-[0.04em] text-muted-foreground uppercase">
                      {formatTimestamp(item.at)} · {item.meta}
                    </span>
                  </span>
                  {item.amount ? (
                    <span className="font-semibold whitespace-nowrap tabular-nums">
                      {formatMoney(item.amount)}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
