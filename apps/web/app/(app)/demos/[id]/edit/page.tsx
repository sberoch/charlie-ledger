"use client"

import { use } from "react"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { PageHeader } from "@/components/shell/page-header"
import { DemoForm } from "@/features/demos/demo-form"
import { useDemo } from "@/features/demos/hooks"

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: demo, isPending } = useDemo(id)
  if (isPending || !demo) return <Skeleton className="h-64" />
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Edit Demo" subtitle={demo.workingName} />
      <DemoForm existing={demo} />
    </div>
  )
}
