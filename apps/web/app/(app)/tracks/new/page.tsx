"use client"

import { PageHeader } from "@/components/shell/page-header"
import { TrackForm } from "@/features/tracks/track-form"

export default function Page() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="New Track" />
      <TrackForm />
    </div>
  )
}
