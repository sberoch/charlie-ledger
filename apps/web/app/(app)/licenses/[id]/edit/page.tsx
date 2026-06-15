"use client"

import { use } from "react"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { PageHeader } from "@/components/shell/page-header"
import { LicenseForm } from "@/features/licenses/license-form"
import { useLicense } from "@/features/licenses/hooks"

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: license, isPending } = useLicense(id)
  if (isPending || !license) return <Skeleton className="h-64" />
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Edit License"
        subtitle={`${license.trackName} × ${license.brandName}`}
      />
      <LicenseForm existing={license} />
    </div>
  )
}
