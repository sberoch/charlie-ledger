"use client"

import Link from "next/link"
import { formatMoney, type TimelineItemDto } from "@workspace/shared"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import { Panel, PanelLink } from "@/components/panel"
import { formatDate } from "@/lib/format"

const RUST = "#8b3a2a"
const OCHRE = "#b8843a"
const INK = "#1a1a1a"

function dotColor(item: TimelineItemDto): string {
  if (item.kind === "demo_hold_lift") return INK
  return item.daysOut < 14 ? RUST : OCHRE
}

function itemHref(item: TimelineItemDto): string {
  return item.kind === "demo_hold_lift"
    ? `/demos/${item.sourceId}`
    : `/licenses/${item.sourceId}`
}

function itemKey(item: TimelineItemDto): string {
  return `${item.kind}-${item.sourceId}`
}

function kindLabel(item: TimelineItemDto): string {
  return item.kind === "demo_hold_lift" ? "Hold lifts" : "Expiration"
}

function openLabel(item: TimelineItemDto): string {
  return item.kind === "demo_hold_lift" ? "Open demo →" : "Open license →"
}

function Marker({ item }: { item: TimelineItemDto }) {
  return (
    <span
      className={cn(
        "size-[7px] shrink-0",
        item.kind === "demo_hold_lift"
          ? "rotate-45 border border-foreground bg-background"
          : "rounded-full"
      )}
      style={
        item.kind === "demo_hold_lift"
          ? undefined
          : { background: dotColor(item) }
      }
    />
  )
}

/** Groups items within 3 days of each other so axis touch targets stay ≥24px. */
function clusterByProximity(items: TimelineItemDto[]): TimelineItemDto[][] {
  const sorted = [...items].sort((a, b) => a.daysOut - b.daysOut)
  const clusters: TimelineItemDto[][] = []
  for (const item of sorted) {
    const last = clusters[clusters.length - 1]
    if (last && item.daysOut - (last[0]?.daysOut ?? 0) <= 3) last.push(item)
    else clusters.push([item])
  }
  return clusters
}

function ItemDetail({ item }: { item: TimelineItemDto }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-semibold">{item.title}</span>
        <span className="text-sm font-semibold tabular-nums">
          {formatMoney(item.fee)}
        </span>
      </div>
      <div className="text-[11px] tracking-[0.05em] text-muted-foreground uppercase">
        {item.meta}
      </div>
      <div className="text-xs text-muted-foreground">
        {kindLabel(item)} · {formatDate(item.date)} · in {item.daysOut} days
      </div>
      <Link
        href={itemHref(item)}
        className="mt-1 text-xs font-semibold underline decoration-border underline-offset-3 hover:decoration-foreground"
      >
        {openLabel(item)}
      </Link>
    </div>
  )
}

/** A dot (or cluster badge) on the axis: hover tooltip, click popover with detail + link. */
function AxisDot({ cluster }: { cluster: TimelineItemDto[] }) {
  const first = cluster[0]
  const last = cluster[cluster.length - 1]
  if (!first || !last) return null
  const pct = (Math.min(first.daysOut, 60) / 60) * 100
  const worst = cluster.some(
    (i) => i.kind === "license_expiration" && i.daysOut < 14
  )
    ? RUST
    : cluster.some((i) => i.kind === "license_expiration")
      ? OCHRE
      : INK

  const trigger =
    cluster.length === 1 ? (
      <button
        type="button"
        aria-label={`${first.title}, in ${first.daysOut} days`}
        className="absolute top-1/2 grid size-7 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full hover:bg-black/[0.05] data-[state=open]:bg-black/[0.07]"
        style={{ left: `${pct}%` }}
      >
        {first.kind === "demo_hold_lift" ? (
          <span className="size-[9px] rotate-45 border-[1.5px] border-foreground bg-background" />
        ) : (
          <span
            className="size-[11px] rounded-full"
            style={{ background: dotColor(first) }}
          />
        )}
      </button>
    ) : (
      <button
        type="button"
        aria-label={`${cluster.length} items around day ${first.daysOut}`}
        className="absolute top-1/2 grid h-[22px] min-w-[22px] -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full px-1 text-[10px] font-semibold text-white hover:opacity-85 data-[state=open]:ring-2 data-[state=open]:ring-foreground/30"
        style={{ left: `${pct}%`, background: worst }}
      >
        {cluster.length}
      </button>
    )

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent sideOffset={6}>
          {cluster.length === 1
            ? `${first.title} · ${first.daysOut}d · ${formatMoney(first.fee)}`
            : `${cluster.length} items · day ${first.daysOut}–${last.daysOut}`}
        </TooltipContent>
      </Tooltip>
      <PopoverContent sideOffset={6} className="w-80">
        {cluster.length === 1 ? (
          <ItemDetail item={first} />
        ) : (
          <div className="flex flex-col">
            {cluster.map((item) => (
              <Link
                key={itemKey(item)}
                href={itemHref(item)}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5 border-b border-border-soft py-2 first:pt-0.5 last:border-0 last:pb-0.5 hover:bg-black/[0.02]"
              >
                <Marker item={item} />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold">
                    {item.title}
                  </span>
                  <span className="block text-[10.5px] tracking-[0.04em] text-muted-foreground uppercase">
                    {item.daysOut}d · {item.meta}
                  </span>
                </span>
                <span className="text-xs font-semibold tabular-nums">
                  {formatMoney(item.fee)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

/** The 60-day axis — circles are expirations (risk), diamonds are demo holds
    lifting (opportunity). Each dot opens a popover linking into its item. */
function TimelineAxis({
  items,
  urgentCount,
}: {
  items: TimelineItemDto[]
  urgentCount: number
}) {
  return (
    <div className="mb-4 border-b border-border-soft pb-3">
      <div
        role="group"
        aria-label="Expiration timeline"
        className="relative h-14"
      >
        {/* risk zone 0–14d */}
        <div
          className="absolute top-1/2 left-0 h-3.5 -translate-y-1/2 bg-rust/[0.06]"
          style={{ width: `${(14 / 60) * 100}%` }}
        />
        <div className="absolute top-1/2 right-0 left-0 h-px -translate-y-1/2 bg-[#d9d5cd]" />
        {[0, 14 / 60, 30 / 60, 1].map((p, i) => (
          <div
            key={p}
            className={cn(
              "absolute top-1/2 w-px -translate-y-1/2",
              i === 0 || i === 3 ? "h-2.5 bg-foreground" : "h-2 bg-[#d9d5cd]"
            )}
            style={{ left: `${p * 100}%` }}
          />
        ))}
        {clusterByProximity(items).map((cluster) => (
          <AxisDot key={itemKey(cluster[0]!)} cluster={cluster} />
        ))}
      </div>
      <div className="relative mx-3 mb-2 h-4 text-[10px] tracking-[0.12em] text-muted-foreground">
        <span className="absolute left-0">TODAY</span>
        <span className="absolute left-[23.33%] -translate-x-1/2">14D</span>
        <span className="absolute left-1/2 -translate-x-1/2">30D</span>
        <span className="absolute right-0">60D</span>
      </div>
      <div className="flex gap-4 text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-rust" /> Expiration
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rotate-45 border border-foreground bg-background" />{" "}
          Hold lifts
        </span>
      </div>
    </div>
  )
}

function TimelineRow({
  item,
  secondary,
}: {
  item: TimelineItemDto
  secondary?: boolean
}) {
  const markerClass =
    item.kind === "demo_hold_lift"
      ? "text-foreground"
      : item.daysOut < 14
        ? "text-rust font-semibold"
        : item.daysOut <= 60
          ? "text-ochre font-semibold"
          : "text-muted-foreground"
  return (
    <Link
      href={itemHref(item)}
      className={cn(
        "grid grid-cols-[64px_1fr_auto] items-center gap-3 border-b border-border-soft py-3 last:border-0 hover:bg-black/[0.02] md:gap-4",
        secondary && "py-2.5"
      )}
    >
      <span className={cn("flex items-center gap-2 text-[13px]", markerClass)}>
        <Marker item={item} />
        {item.daysOut}d
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block truncate font-semibold",
            secondary ? "text-[13px] font-medium" : "text-sm"
          )}
        >
          {item.title}
        </span>
        <span className="mt-0.5 block truncate text-[11px] tracking-[0.05em] text-muted-foreground uppercase">
          {item.meta}
        </span>
      </span>
      <span
        className={cn(
          "text-[13.5px] font-semibold tabular-nums",
          secondary && "font-medium text-ink-soft"
        )}
      >
        {formatMoney(item.fee)}
      </span>
    </Link>
  )
}

export function TimelinePanel({
  timeline,
  atRisk,
}: {
  timeline: TimelineItemDto[]
  atRisk: { amount: string; licenseCount: number; renewalRate: number | null }
}) {
  const within60 = timeline.filter((t) => t.daysOut <= 60)
  const beyond60 = timeline.filter((t) => t.daysOut > 60).slice(0, 5)
  const urgentCount = within60.filter(
    (t) => t.kind === "license_expiration" && t.daysOut < 14
  ).length

  return (
    <TooltipProvider>
      <Panel
        title="Upcoming · Next 60 Days"
        action={<PanelLink href="/licenses">View all →</PanelLink>}
        className="h-full"
      >
        <TimelineAxis items={within60} urgentCount={urgentCount} />

        <div className="flex flex-col">
          {within60.map((item) => (
            <TimelineRow key={itemKey(item)} item={item} />
          ))}
          {within60.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing in the next 60 days.
            </p>
          ) : null}
        </div>

        {beyond60.length > 0 ? (
          <>
            <div className="mt-5 mb-1 border-b border-border-soft pb-2 text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
              Beyond 60 Days
            </div>
            <div className="flex flex-col">
              {beyond60.map((item) => (
                <TimelineRow key={itemKey(item)} item={item} secondary />
              ))}
            </div>
          </>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-3 border-t pt-5">
          <div>
            <div className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
              Revenue at Risk · 60d
            </div>
            <div className="mt-1 text-[11px] tracking-[0.04em] text-muted-foreground">
              Across{" "}
              <strong className="text-foreground">
                {atRisk.licenseCount} licenses
              </strong>
              {atRisk.renewalRate !== null ? (
                <>
                  {" "}
                  · historical renewal rate{" "}
                  <strong className="text-foreground">
                    {Math.round(atRisk.renewalRate * 100)}%
                  </strong>
                </>
              ) : null}
            </div>
          </div>
          <div className="font-heading text-xl tracking-tight md:text-2xl">
            {formatMoney(atRisk.amount)}
          </div>
        </div>
      </Panel>
    </TooltipProvider>
  )
}
