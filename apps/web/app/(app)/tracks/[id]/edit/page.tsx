"use client"

import { use } from "react"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { PageHeader } from "@/components/shell/page-header"
import { TrackForm } from "@/features/tracks/track-form"
import { useTrack } from "@/features/tracks/hooks"

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: track, isPending } = useTrack(id)
  if (isPending || !track) return <Skeleton className="h-64" />
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Edit Track" subtitle={track.name} />
      <TrackForm existing={track} />
    </div>
  )
}
