"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  EXCLUSIVITY_TIER_SHORT,
  TERM_LENGTH_LABELS,
  TERM_LENGTH_SHORT,
  formatUsageTypes,
  expirationState,
  formatMoney,
  todayIso,
  type ExpirationUrgency,
  type TermLength,
  type UsageType,
} from "@workspace/shared"
import { X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { FilterChips } from "@/components/filter-chips"
import { UrgencyPill } from "@/components/pills"
import { PageHeader } from "@/components/shell/page-header"
import { formatDate } from "@/lib/format"
import { useLicenses } from "./hooks"

const URGENCY_OPTIONS: Array<{ value: ExpirationUrgency; label: string }> = [
  { value: "active", label: "Active" },
  { value: "expiring_soon", label: "Expiring Soon" },
  { value: "urgent", label: "Urgent" },
  { value: "expired", label: "Expired" },
]

const USAGE_OPTIONS: Array<{ value: UsageType; label: string }> = [
  { value: "broadcast", label: "Broadcast" },
  { value: "digital_media", label: "Digital" },
  { value: "social_media", label: "Social" },
  { value: "internet", label: "Internet" },
  { value: "internal", label: "Internal" },
]

const TERM_OPTIONS: Array<{ value: TermLength; label: string }> = (
  Object.entries(TERM_LENGTH_LABELS) as Array<[TermLength, string]>
).map(([value, label]) => ({ value, label }))

const URGENCY_BORDER: Record<ExpirationUrgency, string> = {
  urgent: "border-l-rust",
  expiring_soon: "border-l-ochre",
  active: "border-l-foreground",
  expired: "border-l-border",
}

export function LicensesPage() {
  const router = useRouter()
  const [urgency, setUrgency] = useState<ExpirationUrgency | null>(null)
  const [usage, setUsage] = useState<UsageType | null>(null)
  const [term, setTerm] = useState<TermLength | null>(null)
  const [search, setSearch] = useState("")
  const hasFilters = urgency !== null || usage !== null || term !== null || search !== ""
  const clearFilters = () => {
    setUrgency(null)
    setUsage(null)
    setTerm(null)
    setSearch("")
  }
  const { data: licenses, isPending } = useLicenses({
    urgency: urgency ?? undefined,
    usageType: usage ?? undefined,
    termLength: term ?? undefined,
    search: search || undefined,
  })
  const today = todayIso()

  return (
    <div>
      <PageHeader
        title="Licenses"
        subtitle={
          licenses
            ? `${licenses.length} records · sorted by expiration`
            : "Loading…"
        }
      >
        <Button asChild>
          <Link href="/licenses/new">+ New License</Link>
        </Button>
      </PageHeader>

      <div className="mb-5 flex flex-col gap-3 border bg-card p-3.5 lg:flex-row lg:items-center lg:gap-5">
        <FilterChips
          label="Status"
          options={URGENCY_OPTIONS}
          value={urgency}
          onChange={setUrgency}
          variant="select"
        />
        <FilterChips
          label="Usage"
          options={USAGE_OPTIONS}
          value={usage}
          onChange={setUsage}
          variant="select"
        />
        <FilterChips
          label="Term"
          options={TERM_OPTIONS}
          value={term}
          onChange={setTerm}
          variant="select"
        />
        <Input
          placeholder="Search brand or track…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="lg:ml-auto lg:max-w-52"
        />
        {hasFilters ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={clearFilters}
            aria-label="Clear filters"
            title="Clear filters"
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>

      {isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : (
        <>
          {/* Mobile: urgency-bordered cards (the prototype's exp-row pattern) */}
          <ul className="flex flex-col gap-2 md:hidden">
            {licenses?.map((license) => {
              const { urgency: u } = expirationState(license.endDate, today)
              return (
                <li key={license.id}>
                  <Link
                    href={`/licenses/${license.id}`}
                    className={cn(
                      "flex items-center gap-3 border border-l-2 bg-card p-3.5",
                      URGENCY_BORDER[u],
                      u === "expired" && "opacity-60"
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {license.trackName}
                        <span className="mx-1.5 font-normal text-muted-foreground">
                          ×
                        </span>
                        {license.brandName}
                      </span>
                      <span className="mt-1 block text-[11px] tracking-[0.05em] text-muted-foreground uppercase">
                        {formatUsageTypes(license.usageTypes)} ·{" "}
                        {TERM_LENGTH_SHORT[license.termLength]} ·{" "}
                        {EXCLUSIVITY_TIER_SHORT[license.exclusivityTier]}
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1.5">
                      <span className="text-sm font-semibold tabular-nums">
                        {formatMoney(license.fee)}
                      </span>
                      <UrgencyPill endDate={license.endDate} />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>

          {/* Desktop: the prototype table */}
          <table className="hidden w-full border-collapse text-[13.5px] md:table">
            <thead>
              <tr className="border-b border-foreground text-left text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
                <th className="py-3.5 pr-3.5 pl-3.5 font-medium">Track</th>
                <th className="px-3.5 py-3.5 font-medium">Brand</th>
                <th className="px-3.5 py-3.5 font-medium">Usage</th>
                <th className="px-3.5 py-3.5 font-medium">Term</th>
                <th className="px-3.5 py-3.5 font-medium">Expires</th>
                <th className="px-3.5 py-3.5 text-right font-medium">Fee</th>
                <th className="px-3.5 py-3.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {licenses?.map((license) => {
                const { urgency: u } = expirationState(license.endDate, today)
                return (
                  <tr
                    key={license.id}
                    onClick={() => router.push(`/licenses/${license.id}`)}
                    className={cn(
                      "cursor-pointer border-b border-border-soft transition-colors hover:bg-black/[0.025]",
                      u === "expired" && "text-muted-foreground"
                    )}
                  >
                    <td
                      className={cn(
                        "border-l-2 px-3.5 py-4 font-semibold",
                        URGENCY_BORDER[u]
                      )}
                    >
                      {license.trackName}
                    </td>
                    <td className="px-3.5 py-4">{license.brandName}</td>
                    <td className="px-3.5 py-4">
                      {formatUsageTypes(license.usageTypes)}
                    </td>
                    <td className="px-3.5 py-4">
                      {TERM_LENGTH_SHORT[license.termLength]} ·{" "}
                      {EXCLUSIVITY_TIER_SHORT[license.exclusivityTier]}
                    </td>
                    <td className="px-3.5 py-4">
                      {license.endDate
                        ? formatDate(license.endDate)
                        : "Perpetual"}
                    </td>
                    <td className="px-3.5 py-4 text-right font-semibold tabular-nums">
                      {formatMoney(license.fee)}
                    </td>
                    <td className="px-3.5 py-4">
                      <UrgencyPill endDate={license.endDate} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {licenses?.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No licenses match.
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}
