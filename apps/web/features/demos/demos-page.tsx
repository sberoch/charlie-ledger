"use client"

import { useState } from "react"
import Link from "next/link"
import { formatMoney, type DemoStatus } from "@workspace/shared"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { FilterChips } from "@/components/filter-chips"
import { PageHeader } from "@/components/shell/page-header"
import { formatDate } from "@/lib/format"
import { useDemos } from "./hooks"

type DemoFilter = DemoStatus | "ready"

export function HoldBadge({
  demo,
}: {
  demo: { status: DemoStatus; holdLifted: boolean; holdEndsAt: string }
}) {
  if (demo.status === "converted")
    return <Badge variant="active">Converted</Badge>
  if (demo.holdLifted) return <Badge variant="warn">Ready to reuse</Badge>
  return <Badge>Hold · lifts {formatDate(demo.holdEndsAt)}</Badge>
}

export function DemosPage() {
  const [filter, setFilter] = useState<DemoFilter | null>(null)
  const [search, setSearch] = useState("")
  const { data: demos, isPending } = useDemos({
    status: filter === "ready" ? "open" : (filter ?? undefined),
    readyToConvert: filter === "ready" ? true : undefined,
    search: search || undefined,
  })

  return (
    <div>
      <PageHeader
        title="Demos"
        subtitle={demos ? `${demos.length} commissioned cues` : "Loading…"}
      >
        <Button asChild>
          <Link href="/demos/new">+ New Demo</Link>
        </Button>
      </PageHeader>

      <div className="mb-5 flex flex-col gap-3 border bg-card p-3.5 md:flex-row md:items-center md:gap-4">
        <FilterChips
          options={[
            { value: "open", label: "Open" },
            { value: "ready", label: "Ready to reuse" },
            { value: "converted", label: "Converted" },
          ]}
          value={filter}
          onChange={setFilter}
        />
        <Input
          placeholder="Search working name or brand…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="md:ml-auto md:max-w-56"
        />
      </div>

      {isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {demos?.map((demo) => (
            <li key={demo.id}>
              <Link
                href={`/demos/${demo.id}`}
                className="flex flex-col gap-2 border bg-card p-3.5 transition-colors hover:bg-black/[0.015] md:flex-row md:items-center md:gap-4"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {demo.workingName}
                  </span>
                  <span className="mt-1 block text-[11px] tracking-[0.05em] text-muted-foreground uppercase">
                    for {demo.brandName} · {demo.payerName} · written{" "}
                    {formatDate(demo.writtenAt)}
                  </span>
                </span>
                <span className="flex items-center gap-3 md:gap-4">
                  <HoldBadge demo={demo} />
                  <span className="ml-auto text-sm font-semibold tabular-nums md:ml-0 md:w-20 md:text-right">
                    {formatMoney(demo.fee)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
          {demos?.length === 0 ? (
            <li className="py-12 text-center text-sm text-muted-foreground">
              No demos {filter ? "in this state" : "yet"}. They appear here as
              music houses commission them.
            </li>
          ) : null}
        </ul>
      )}
    </div>
  )
}
