"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { formatMoney } from "@workspace/shared"
import { Badge } from "@workspace/ui/components/badge"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { FilterChips } from "@/components/filter-chips"
import { PageHeader } from "@/components/shell/page-header"
import { formatDate } from "@/lib/format"
import { useTracks, useTrackTags } from "./hooks"
import { TrackExportDialog } from "./track-export-dialog"

export function TracksPage() {
  const router = useRouter()
  const [tag, setTag] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const { data: tags = [] } = useTrackTags()
  const { data: tracks, isPending } = useTracks({
    tag: tag ?? undefined,
    search: search || undefined,
  })

  return (
    <div>
      <PageHeader
        title="Tracks"
        subtitle={tracks ? `${tracks.length} tracks in library` : "Loading…"}
      >
        <TrackExportDialog tags={tags} currentTag={tag} search={search} />
      </PageHeader>

      <div className="mb-5 flex flex-col gap-3 border bg-card p-3.5 md:flex-row md:items-center md:gap-4">
        <FilterChips
          label="Tag"
          options={tags.map((t) => ({ value: t, label: t }))}
          value={tag}
          onChange={setTag}
          allLabel="All Tags"
        />
        <Input
          placeholder="Search tracks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="md:ml-auto md:max-w-56"
        />
      </div>

      {isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <ul className="flex flex-col md:hidden">
            {tracks?.map((track, i) => (
              <li key={track.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/tracks/${track.id}`)}
                  className="flex w-full cursor-pointer items-center gap-3 border-b border-border-soft py-3.5 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {track.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] tracking-[0.04em] text-muted-foreground">
                      {track.licenseCount} licenses ·{" "}
                      {track.tags.slice(0, 3).join(", ")}
                    </span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatMoney(track.lifetimeSales)}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {/* Desktop: the prototype table */}
          <table className="hidden w-full border-collapse text-[13.5px] md:table">
            <thead>
              <tr className="border-b border-foreground text-left text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
                <th className="px-3.5 py-3.5 font-medium">Track</th>
                <th className="px-3.5 py-3.5 font-medium">Tags</th>
                <th className="px-3.5 py-3.5 text-right font-medium">
                  Licenses
                </th>
                <th className="px-3.5 py-3.5 text-right font-medium">
                  Lifetime
                </th>
                <th className="px-3.5 py-3.5 text-right font-medium">
                  Last Licensed
                </th>
              </tr>
            </thead>
            <tbody>
              {tracks?.map((track, i) => (
                <tr
                  key={track.id}
                  onClick={() => router.push(`/tracks/${track.id}`)}
                  className="cursor-pointer border-b border-border-soft transition-colors hover:bg-black/[0.025]"
                >
                  <td className="px-3.5 py-4 font-semibold">
                    {track.name}
                    {track.status === "archived" ? (
                      <Badge variant="expired" className="ml-2">
                        Archived
                      </Badge>
                    ) : null}
                  </td>
                  <td className="px-3.5 py-4">
                    <span className="flex flex-wrap gap-1.5">
                      {track.tags.map((t) => (
                        <Badge key={t} variant="tag">
                          {t}
                        </Badge>
                      ))}
                    </span>
                  </td>
                  <td className="px-3.5 py-4 text-right tabular-nums">
                    {track.licenseCount}
                  </td>
                  <td className="px-3.5 py-4 text-right font-semibold tabular-nums">
                    {formatMoney(track.lifetimeSales)}
                  </td>
                  <td className="px-3.5 py-4 text-right text-muted-foreground tabular-nums">
                    {track.lastLicensedAt
                      ? formatDate(track.lastLicensedAt)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {tracks?.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No tracks match.
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}
