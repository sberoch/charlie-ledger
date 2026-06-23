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
import { useMarkReminderDone } from "./hooks"

const RUST = "#8b3a2a"
const OCHRE = "#b8843a"
const INK = "#1a1a1a"

function dotColor(item: TimelineItemDto): string {
  if (item.kind === "demo_hold_lift") return INK
  // Reminders share the risk palette with expirations (overdue/<14d = rust);
  // their square marker keeps them visually distinct from license circles.
  return item.daysOut < 14 ? RUST : OCHRE
}

/** Reminders have no detail page — their sourceId is the reminder's own id, and
 *  the only action is "mark done", so they are never linked. */
function itemHref(item: TimelineItemDto): string | null {
  if (item.kind === "reminder") return null
  return item.kind === "demo_hold_lift"
    ? `/demos/${item.sourceId}`
    : `/licenses/${item.sourceId}`
}

function itemKey(item: TimelineItemDto): string {
  return `${item.kind}-${item.sourceId}`
}

function kindLabel(item: TimelineItemDto): string {
  if (item.kind === "reminder") return "Reminder"
  return item.kind === "demo_hold_lift" ? "Hold lifts" : "Expiration"
}

function openLabel(item: TimelineItemDto): string {
  return item.kind === "demo_hold_lift" ? "Open demo →" : "Open license →"
}

/** "4d" / "3d overdue" — reminders can run negative; derived items never do. */
function dayLabel(item: TimelineItemDto): string {
  return item.daysOut < 0 ? `${-item.daysOut}d overdue` : `${item.daysOut}d`
}

function Marker({ item }: { item: TimelineItemDto }) {
  if (item.kind === "demo_hold_lift")
    return (
      <span className="size-[7px] shrink-0 rotate-45 border border-foreground bg-background" />
    )
  if (item.kind === "reminder")
    return (
      <span
        className="size-[7px] shrink-0 border"
        style={{ borderColor: dotColor(item), background: dotColor(item) }}
      />
    )
  return (
    <span
      className="size-[7px] shrink-0 rounded-full"
      style={{ background: dotColor(item) }}
    />
  )
}

/** The done button shared by the reminder row and its popover detail. */
function ReminderDoneButton({
  id,
  className,
}: {
  id: string
  className?: string
}) {
  const markDone = useMarkReminderDone()
  return (
    <button
      type="button"
      disabled={markDone.isPending}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        markDone.mutate(id)
      }}
      className={cn(
        "rounded border border-border px-2 py-1 text-[11px] font-semibold tracking-[0.04em] uppercase hover:bg-black/[0.04] disabled:opacity-50",
        className
      )}
    >
      {markDone.isPending ? "..." : "Done"}
    </button>
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
  const href = itemHref(item)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-semibold">{item.title}</span>
        {item.fee !== null ? (
          <span className="text-sm font-semibold tabular-nums">
            {formatMoney(item.fee)}
          </span>
        ) : null}
      </div>
      <div className="text-[11px] tracking-[0.05em] text-muted-foreground uppercase">
        {item.meta}
      </div>
      <div className="text-xs text-muted-foreground">
        {kindLabel(item)} · {formatDate(item.date)} ·{" "}
        {item.daysOut < 0
          ? `${-item.daysOut} days overdue`
          : `in ${item.daysOut} days`}
      </div>
      {href ? (
        <Link
          href={href}
          className="mt-1 text-xs font-semibold underline decoration-border underline-offset-3 hover:decoration-foreground"
        >
          {openLabel(item)}
        </Link>
      ) : (
        <ReminderDoneButton id={item.sourceId} className="mt-1 self-start" />
      )}
    </div>
  )
}

/** A dot (or cluster badge) on the axis: hover tooltip, click popover with detail + link. */
function AxisDot({ cluster }: { cluster: TimelineItemDto[] }) {
  const first = cluster[0]
  const last = cluster[cluster.length - 1]
  if (!first || !last) return null
  // Clamp to [0,60]: overdue reminders (negative daysOut) pin to TODAY rather
  // than sliding off the left edge.
  const pct = (Math.max(0, Math.min(first.daysOut, 60)) / 60) * 100
  // Expirations and reminders share the risk palette; demo holds stay ink.
  const risky = (i: TimelineItemDto) => i.kind !== "demo_hold_lift"
  const worst = cluster.some((i) => risky(i) && i.daysOut < 14)
    ? RUST
    : cluster.some(risky)
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
        ) : first.kind === "reminder" ? (
          <span
            className="size-[10px]"
            style={{ background: dotColor(first) }}
          />
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
            ? `${first.title} · ${dayLabel(first)}${
                first.fee !== null ? ` · ${formatMoney(first.fee)}` : ""
              }`
            : `${cluster.length} items · day ${first.daysOut}–${last.daysOut}`}
        </TooltipContent>
      </Tooltip>
      <PopoverContent sideOffset={6} className="w-80">
        {cluster.length === 1 ? (
          <ItemDetail item={first} />
        ) : (
          <div className="flex flex-col">
            {cluster.map((item) => {
              const href = itemHref(item)
              const rowClass =
                "grid grid-cols-[auto_1fr_auto] items-center gap-2.5 border-b border-border-soft py-2 first:pt-0.5 last:border-0 last:pb-0.5"
              const inner = (
                <>
                  <Marker item={item} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold">
                      {item.title}
                    </span>
                    <span className="block text-[10.5px] tracking-[0.04em] text-muted-foreground uppercase">
                      {dayLabel(item)} · {item.meta}
                    </span>
                  </span>
                  {item.fee !== null ? (
                    <span className="text-xs font-semibold tabular-nums">
                      {formatMoney(item.fee)}
                    </span>
                  ) : (
                    <ReminderDoneButton id={item.sourceId} />
                  )}
                </>
              )
              return href ? (
                <Link
                  key={itemKey(item)}
                  href={href}
                  className={cn(rowClass, "hover:bg-black/[0.02]")}
                >
                  {inner}
                </Link>
              ) : (
                <div key={itemKey(item)} className={rowClass}>
                  {inner}
                </div>
              )
            })}
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
        <span className="flex items-center gap-1.5">
          <span className="size-2 bg-rust" /> Reminder
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
  const href = itemHref(item)
  const rowClass = cn(
    "grid grid-cols-[64px_1fr_auto] items-center gap-3 border-b border-border-soft py-3 last:border-0 md:gap-4",
    secondary && "py-2.5"
  )
  const inner = (
    <>
      <span className={cn("flex items-center gap-2 text-[13px]", markerClass)}>
        <Marker item={item} />
        {dayLabel(item)}
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
      {item.fee !== null ? (
        <span
          className={cn(
            "text-[13.5px] font-semibold tabular-nums",
            secondary && "font-medium text-ink-soft"
          )}
        >
          {formatMoney(item.fee)}
        </span>
      ) : (
        <ReminderDoneButton id={item.sourceId} />
      )}
    </>
  )
  return href ? (
    <Link href={href} className={cn(rowClass, "hover:bg-black/[0.02]")}>
      {inner}
    </Link>
  ) : (
    <div className={rowClass}>{inner}</div>
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
