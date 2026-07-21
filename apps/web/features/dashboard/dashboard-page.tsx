"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { USAGE_TYPE_LABELS, formatMoney, todayIso } from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { Panel, PanelLink } from "@/components/panel"
import { useSession } from "@/lib/auth-client"
import { formatDate, formatTimestamp } from "@/lib/format"
import { useConvertDemo } from "@/features/demos/hooks"
import { MonthIncomeDialog, UnpaidInvoicesDialog } from "./earnings-dialogs"
import { useDashboard } from "./hooks"
import { TimelinePanel } from "./timeline-panel"

const DONUT_COLORS = ["#1a1a1a", "#4a4a4a", "#7a7670", "#a8a39a", "#c4bfb5"]

/** Tag donuts need more distinct slices than the usage donut — a warm,
 *  ledger-toned ramp; "Other" gets its own fixed light neutral. */
const TAG_DONUT_COLORS = [
  "#1a1a1a",
  "#8a4a2b",
  "#4a4a4a",
  "#a8763e",
  "#7a7670",
  "#5c6558",
  "#a8a39a",
]

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
  onClick,
}: {
  label: string
  value: string
  muted?: boolean
  onClick?: () => void
}) {
  const body = (
    <>
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
    </>
  )
  if (!onClick) return <div>{body}</div>
  return (
    <button
      type="button"
      onClick={onClick}
      className="-m-1 cursor-pointer p-1 text-left hover:bg-black/[0.02]"
    >
      {body}
    </button>
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
  const [monthOpen, setMonthOpen] = useState(false)
  const [unpaidOpen, setUnpaidOpen] = useState(false)
  const now = new Date()
  const month = now.toLocaleDateString("en-US", { month: "long" })
  const year = now.getFullYear()
  const lastYear = year - 1
  const today = todayIso()
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
          onClick={() => setMonthOpen(true)}
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
      <button
        type="button"
        onClick={() => setUnpaidOpen(true)}
        className="mt-4 flex w-full cursor-pointer items-baseline justify-between gap-3 border-t border-border-soft pt-3.5 text-left hover:bg-black/[0.02]"
      >
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
      </button>
      <MonthIncomeDialog
        open={monthOpen}
        onOpenChange={setMonthOpen}
        from={`${today.slice(0, 7)}-01`}
        to={today}
        label={`${month} ${year}`}
      />
      {/* Mounted lazily so the invoice list isn't fetched until asked for. */}
      {unpaidOpen ? (
        <UnpaidInvoicesDialog open onOpenChange={setUnpaidOpen} />
      ) : null}
    </Panel>
  )
}

type TagShare = {
  tag: string
  amount: string
  share: number
  licenseCount: number
  brands: Array<{ brandName: string; amount: string }>
  isOther: boolean
}

function TagDonut({
  slices,
  colorOf,
  selected,
  onSelect,
  label,
}: {
  slices: TagShare[]
  colorOf: (tag: string) => string
  selected: string | null
  onSelect: (tag: string) => void
  label: string
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 42 42" className="size-24 md:size-28">
        <circle
          cx="21"
          cy="21"
          r="15.9155"
          fill="transparent"
          stroke="#e3e0d8"
          strokeWidth="6"
        />
        {slices.map((slice, i) => {
          const pct = slice.share * 100
          const offset =
            25 - slices.slice(0, i).reduce((sum, s) => sum + s.share * 100, 0)
          return (
            <circle
              key={slice.tag}
              cx="21"
              cy="21"
              r="15.9155"
              fill="transparent"
              stroke={colorOf(slice.tag)}
              strokeWidth="6"
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeDashoffset={offset}
              transform="rotate(-90 21 21)"
              className="cursor-pointer"
              opacity={selected && selected !== slice.tag ? 0.3 : 1}
              onClick={() => onSelect(slice.tag)}
            />
          )
        })}
      </svg>
      <span className="text-[11px] tracking-[0.05em] text-muted-foreground uppercase">
        {label}
      </span>
    </div>
  )
}

/** Side-by-side style-mix donuts, YTD vs last year to the same date. Shares
 *  are normalized against the tag-weighted sum (a fee counts toward each of
 *  its track's tags — ADR-0004's usage-donut move), so slices partition to
 *  100% of the MIX, not of revenue. Tap a slice or legend row for the
 *  per-brand breakdown, shown per window. */
function TagTrendDonuts({
  trend,
}: {
  trend: { ytd: TagShare[]; lastYearToDate: TagShare[] }
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const year = new Date().getFullYear()

  // One stable color per tag across both donuts, ranked by YTD first so the
  // two windows stay visually comparable.
  const tags = [
    ...new Set([
      ...trend.ytd.map((s) => s.tag),
      ...trend.lastYearToDate.map((s) => s.tag),
    ]),
  ]
  const colorOf = (tag: string) =>
    tag === "Other"
      ? "#d9d5cb"
      : (TAG_DONUT_COLORS[
          tags.filter((t) => t !== "Other").indexOf(tag) %
            TAG_DONUT_COLORS.length
        ] ?? "#a8a39a")

  const shareOf = (slices: TagShare[], tag: string) => {
    const slice = slices.find((s) => s.tag === tag)
    return slice ? `${Math.round(slice.share * 100)}%` : "—"
  }
  const toggle = (tag: string) => setSelected(selected === tag ? null : tag)

  if (tags.length === 0) {
    return <p className="text-sm text-muted-foreground">No licensed tags yet.</p>
  }

  const selectedSlice = (slices: TagShare[]) =>
    selected ? slices.find((s) => s.tag === selected && !s.isOther) : undefined

  return (
    <div>
      <div className="flex items-start justify-around gap-4">
        <TagDonut
          slices={trend.ytd}
          colorOf={colorOf}
          selected={selected}
          onSelect={toggle}
          label={`${year} to date`}
        />
        <TagDonut
          slices={trend.lastYearToDate}
          colorOf={colorOf}
          selected={selected}
          onSelect={toggle}
          label={`${year - 1} to date`}
        />
      </div>

      <div className="mt-4 flex flex-col gap-1.5">
        <div className="grid grid-cols-[12px_1fr_3rem_3rem] items-center gap-2.5 text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
          <span />
          <span />
          <span className="text-right">{year}</span>
          <span className="text-right">{year - 1}</span>
        </div>
        {tags.map((tag) => (
          <div key={tag}>
            <button
              type="button"
              onClick={() => toggle(tag)}
              className={cn(
                "grid w-full cursor-pointer grid-cols-[12px_1fr_3rem_3rem] items-center gap-2.5 text-left text-[12.5px]",
                selected && selected !== tag && "opacity-50"
              )}
            >
              <span
                className="size-[11px]"
                style={{ background: colorOf(tag) }}
              />
              <span className="truncate tracking-[0.02em]">{tag}</span>
              <span className="text-right text-[11px] text-muted-foreground tabular-nums">
                {shareOf(trend.ytd, tag)}
              </span>
              <span className="text-right text-[11px] text-muted-foreground tabular-nums">
                {shareOf(trend.lastYearToDate, tag)}
              </span>
            </button>
            {selected === tag && tag !== "Other" ? (
              <div className="mt-1.5 mb-1 grid grid-cols-2 gap-x-4 border-l-2 border-border pl-3 text-[11.5px] text-ink-soft">
                {[
                  { label: String(year), slice: selectedSlice(trend.ytd) },
                  {
                    label: String(year - 1),
                    slice: selectedSlice(trend.lastYearToDate),
                  },
                ].map(({ label, slice }) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    {(slice?.brands ?? []).map((b) => (
                      <span key={b.brandName} className="flex justify-between">
                        <span className="truncate">{b.brandName}</span>
                        <span className="tabular-nums">
                          {formatMoney(b.amount)}
                        </span>
                      </span>
                    ))}
                    {!slice || slice.brands.length === 0 ? (
                      <span className="text-muted-foreground">
                        No sales in {label}.
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
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
            <TagTrendDonuts trend={data.tagTrend} />
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

          {/* Anchored on writtenAt — the box reads as output pace, this year
              against last year cut off at the same date. */}
          <Panel title="Demo Income">
            <div className="grid grid-cols-2 gap-x-5">
              <div>
                <div className="text-[11px] tracking-[0.05em] text-muted-foreground uppercase">
                  {now.getFullYear()} · {data.demoIncome.ytdCount} demos
                </div>
                <div className="mt-1 font-heading text-2xl tracking-tight">
                  {formatMoney(data.demoIncome.ytdIncome)}
                </div>
              </div>
              <div>
                <div className="text-[11px] tracking-[0.05em] text-muted-foreground uppercase">
                  {now.getFullYear() - 1} to date ·{" "}
                  {data.demoIncome.lastYearToDateCount} demos
                </div>
                <div className="mt-1 font-heading text-lg tracking-tight text-ink-soft">
                  {formatMoney(data.demoIncome.lastYearToDateIncome)}
                </div>
              </div>
            </div>
            <div className="mt-3.5 border-t border-border-soft pt-3 text-[11px] tracking-[0.04em] text-muted-foreground">
              {data.demoIncome.openCount} open ·{" "}
              {data.demoIncome.convertedCount} converted all-time
            </div>
          </Panel>

          {/* YTD on paymentDate, same paced comparator — a mid-quarter dip vs
              last year is usually PRO distribution timing, not lost income. */}
          <Panel
            title="Royalty Income"
            action={<PanelLink href="/royalties">All royalties →</PanelLink>}
          >
            <div className="grid grid-cols-2 gap-x-5">
              <div>
                <div className="text-[11px] tracking-[0.05em] text-muted-foreground uppercase">
                  {now.getFullYear()} to date ·{" "}
                  {data.royaltyIncome.ytdPaymentCount} payments
                </div>
                <div className="mt-1 font-heading text-2xl tracking-tight">
                  {formatMoney(data.royaltyIncome.ytdTotal)}
                </div>
              </div>
              <div>
                <div className="text-[11px] tracking-[0.05em] text-muted-foreground uppercase">
                  {now.getFullYear() - 1} to date
                </div>
                <div className="mt-1 font-heading text-lg tracking-tight text-ink-soft">
                  {formatMoney(data.royaltyIncome.lastYearToDateTotal)}
                </div>
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
