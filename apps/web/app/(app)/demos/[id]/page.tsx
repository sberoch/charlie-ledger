import { DemoDetailPage } from "@/features/demos/demo-detail-page"

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <DemoDetailPage id={id} />
}
