import { PageHeader } from "@/components/shell/page-header"
import { DemoForm } from "@/features/demos/demo-form"

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New Demo" />
      <DemoForm />
    </div>
  )
}
