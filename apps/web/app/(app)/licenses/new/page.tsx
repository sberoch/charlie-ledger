"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { PageHeader } from "@/components/shell/page-header"
import { LicenseForm } from "@/features/licenses/license-form"

function NewLicense() {
  const params = useSearchParams()
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="New License" />
      <LicenseForm initialTrackId={params.get("trackId") ?? undefined} />
    </div>
  )
}

export default function Page() {
  return (
    <Suspense>
      <NewLicense />
    </Suspense>
  )
}
