"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { formatMoney, todayIso } from "@workspace/shared"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { UrgencyPill } from "@/components/pills"
import { formatDate } from "@/lib/format"
import { useLicenses } from "@/features/licenses/hooks"
import { useDeleteTrack, useSetTrackStatus, useTrack } from "./hooks"

function SectionHead({
  children,
  ext,
}: {
  children: React.ReactNode
  ext?: string
}) {
  return (
    <div className="mb-4 flex items-baseline justify-between text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
      <span>{children}</span>
      {ext ? <span className="tracking-normal normal-case">{ext}</span> : null}
    </div>
  )
}

export function TrackDetailPage({ id }: { id: string }) {
  const router = useRouter()
  const { data: track, isPending } = useTrack(id)
  const { data: licenses } = useLicenses({ trackId: id })
  const setStatus = useSetTrackStatus(id)
  const deleteTrack = useDeleteTrack()

  if (isPending || !track) {
    return <Skeleton className="h-64" />
  }

  const archived = track.status === "archived"
  const demoLinks = track.convertedDemos.length

  const toggleStatus = () =>
    setStatus.mutate(archived ? "active" : "archived", {
      onSuccess: () =>
        toast.success(archived ? "Track restored" : "Track archived"),
      onError: (e) => toast.error(e.message),
    })

  const confirmDelete = () =>
    deleteTrack.mutate(track.id, {
      onSuccess: () => {
        toast.success("Track deleted")
        router.push("/tracks")
      },
      onError: (e) => toast.error(e.message),
    })

  const maxQuarter = Math.max(
    1,
    ...track.quarterlySales.map((q) => Number(q.amount))
  )
  const maxCategory = Math.max(
    1,
    ...track.categoryPerformance.map((c) => Number(c.amount))
  )

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 pb-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="cursor-pointer text-xs text-ink-soft underline decoration-border underline-offset-3 hover:text-foreground"
        >
          ← Back
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/tracks/${track.id}/edit`}>Edit</Link>
          </Button>
          <Button
            variant="outline"
            onClick={toggleStatus}
            disabled={setStatus.isPending}
          >
            {archived ? "Restore" : "Archive"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="text-muted-foreground hover:text-destructive"
              >
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent size="sm">
              {track.licenseCount > 0 ? (
                <>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Can&rsquo;t delete &ldquo;{track.name}&rdquo;
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This track has {track.licenseCount} license
                      {track.licenseCount === 1 ? "" : "s"}, so its history is
                      preserved. Archive it instead to retire it from the
                      catalog.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Close</AlertDialogCancel>
                    <AlertDialogAction onClick={toggleStatus}>
                      {archived ? "Restore" : "Archive instead"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </>
              ) : (
                <>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Delete &ldquo;{track.name}&rdquo;?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This can&rsquo;t be undone.
                      {demoLinks > 0
                        ? ` ${demoLinks} demo conversion link${demoLinks === 1 ? "" : "s"} will be cleared.`
                        : ""}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={confirmDelete}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </>
              )}
            </AlertDialogContent>
          </AlertDialog>
          <Button asChild>
            <Link href={`/licenses/new?trackId=${track.id}`}>
              + License This Track
            </Link>
          </Button>
        </div>
      </div>

      {/* Header */}
      <div className="mb-7 flex flex-col gap-5 border-b pb-7 md:grid md:grid-cols-[90px_1fr_auto] md:items-center md:gap-7">
        <div className="flex size-16 items-center justify-center bg-primary font-heading text-2xl text-primary-foreground md:size-[90px] md:text-3xl">
          {track.name.charAt(0)}
        </div>
        <div>
          <h1 className="font-heading text-3xl tracking-tight md:text-[40px] md:leading-none">
            {track.name}
            {track.status === "archived" ? (
              <Badge variant="expired" className="ml-3 align-middle">
                Archived
              </Badge>
            ) : null}
          </h1>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {track.tags.map((tag) => (
              <Badge key={tag} variant="tag">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex gap-8 md:text-right">
          <div>
            <div className="font-heading text-2xl tracking-tight md:text-3xl">
              {formatMoney(track.lifetimeSales)}
            </div>
            <div className="mt-2 text-[11px] tracking-[0.1em] text-muted-foreground uppercase">
              Lifetime Sales
            </div>
          </div>
          <div>
            <div className="font-heading text-2xl tracking-tight md:text-3xl">
              {track.licenseCount}
            </div>
            <div className="mt-2 text-[11px] tracking-[0.1em] text-muted-foreground uppercase">
              Total Licenses
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div>
          {track.quarterlySales.length > 0 ? (
            <>
              <SectionHead>Sales History</SectionHead>
              <div className="mb-8 flex h-36 items-end gap-2 border-b pb-px">
                {track.quarterlySales.map((q) => (
                  <div
                    key={q.quarter}
                    className="flex flex-1 flex-col items-center gap-1.5"
                  >
                    <div
                      className="w-full max-w-12 bg-primary"
                      style={{
                        height: `${Math.max(4, (Number(q.amount) / maxQuarter) * 120)}px`,
                      }}
                      title={formatMoney(q.amount)}
                    />
                    <span className="text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
                      {q.quarter}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          <SectionHead
            ext={
              licenses
                ? `${licenses.filter((l) => l.endDate === null || l.endDate >= todayIso()).length} active`
                : undefined
            }
          >
            License History
          </SectionHead>
          <ul className="flex flex-col">
            {licenses?.map((license) => (
              <li key={license.id}>
                <Link
                  href={`/licenses/${license.id}`}
                  className="flex items-center gap-3 border-b border-border-soft py-3.5 hover:bg-black/[0.02]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      {license.brandName}
                    </span>
                    <span className="mt-0.5 block text-[11px] tracking-[0.05em] text-muted-foreground uppercase">
                      {license.endDate
                        ? `Expires ${formatDate(license.endDate)}`
                        : "Perpetual"}
                    </span>
                  </span>
                  <UrgencyPill endDate={license.endDate} />
                  <span className="w-20 text-right text-sm font-semibold tabular-nums">
                    {formatMoney(license.fee)}
                  </span>
                </Link>
              </li>
            ))}
            {licenses?.length === 0 ? (
              <li className="py-8 text-center text-sm text-muted-foreground">
                Never licensed yet.
              </li>
            ) : null}
          </ul>
        </div>

        <div>
          <SectionHead ext="Lifetime, by brand category">
            Performance by Category
          </SectionHead>
          <div className="flex flex-col gap-4">
            {track.categoryPerformance.map((c) => (
              <div key={c.categoryId} className="text-[12.5px]">
                <div className="mb-1 flex justify-between">
                  <span className="tracking-[0.04em]">{c.categoryName}</span>
                  <span className="font-semibold tabular-nums">
                    {formatMoney(c.amount)}
                  </span>
                </div>
                <div className="h-2 border bg-secondary">
                  <div
                    className="h-full bg-primary"
                    style={{
                      width: `${(Number(c.amount) / maxCategory) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
            {track.categoryPerformance.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sales yet.</p>
            ) : null}
          </div>

          {track.convertedDemos.length > 0 ? (
            <div className="mt-8">
              <SectionHead>Demo Lineage</SectionHead>
              <ul className="flex flex-col gap-1.5">
                {track.convertedDemos.map((demo) => (
                  <li key={demo.id}>
                    <Link
                      href={`/demos/${demo.id}`}
                      className="text-sm underline decoration-border underline-offset-3 hover:decoration-foreground"
                    >
                      {demo.workingName}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
