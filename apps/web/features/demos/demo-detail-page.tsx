"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  HOLD_PERIOD_LABELS,
  formatInvoiceNumber,
  formatMoney,
} from "@workspace/shared"
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
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Panel } from "@/components/panel"
import { InvoiceStatusPill } from "@/components/pills"
import { EntityCombobox } from "@/features/parties/entity-combobox"
import { useTracks } from "@/features/tracks/hooks"
import { downloadFile } from "@/lib/api"
import { formatDate } from "@/lib/format"
import { HoldBadge } from "./demos-page"
import { useConvertDemo, useDemo, useLinkConvertedTrack } from "./hooks"

function Fact({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium">{children}</div>
    </div>
  )
}

export function DemoDetailPage({ id }: { id: string }) {
  const router = useRouter()
  const { data: demo, isPending } = useDemo(id)
  const { data: tracks = [] } = useTracks()
  const convert = useConvertDemo(id)
  const linkTrack = useLinkConvertedTrack(id)
  const [linking, setLinking] = useState(false)

  if (isPending || !demo) return <Skeleton className="h-64" />

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="cursor-pointer text-xs text-ink-soft underline decoration-border underline-offset-3 hover:text-foreground"
        >
          ← Back
        </button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/demos/${id}/edit`}>Edit Demo</Link>
        </Button>
      </div>

      <div className="mb-6 flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-heading text-2xl tracking-tight break-all md:text-3xl">
            {demo.workingName}
          </h1>
          <div className="mt-2.5 flex items-center gap-2.5">
            <HoldBadge demo={demo} />
            <span className="text-xs tracking-[0.08em] text-muted-foreground uppercase">
              for {demo.brandName}
            </span>
          </div>
        </div>
        <div className="md:text-right">
          <div className="font-heading text-3xl tracking-tight">
            {formatMoney(demo.fee)}
          </div>
          <div className="mt-1.5 text-[11px] tracking-[0.1em] text-muted-foreground uppercase">
            Demo fee · separate from lifetime sales
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-4">
        <Fact label="Music House">{demo.payerName}</Fact>
        <Fact label="Hold">{HOLD_PERIOD_LABELS[demo.holdPeriod]}</Fact>
        <Fact label="Written">{formatDate(demo.writtenAt)}</Fact>
        <Fact label="Hold Lifts">{formatDate(demo.holdEndsAt)}</Fact>
        {demo.notes ? (
          <div className="col-span-2">
            <Fact label="Notes">{demo.notes}</Fact>
          </div>
        ) : null}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Panel title="Conversion">
          {demo.status === "open" ? (
            <div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {demo.holdLifted
                  ? "The hold has lifted. This idea is free to become a library track."
                  : `Hold lifts ${formatDate(demo.holdEndsAt)}. Converting earlier is allowed. The hold is advisory.`}
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" size="sm" className="mt-3">
                    Convert to track idea
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Convert this demo?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Marks the idea as headed for the library. No track needs
                      to exist yet — build it in Disco afterwards and link it
                      here whenever.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        convert
                          .mutateAsync({})
                          .then(() => toast.success("Demo converted"))
                          .catch((e) => toast.error(e.message))
                      }
                    >
                      Convert
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : (
            <div>
              <p className="text-sm">
                Converted
                {demo.convertedTrackName ? (
                  <>
                    {" → "}
                    <Link
                      href={`/tracks/${demo.convertedTrackId}`}
                      className="font-semibold underline decoration-border underline-offset-3 hover:decoration-foreground"
                    >
                      {demo.convertedTrackName}
                    </Link>
                  </>
                ) : null}
              </p>
              {linking ? (
                <div className="mt-3">
                  <EntityCombobox
                    items={tracks.map((t) => ({ id: t.id, name: t.name }))}
                    value={demo.convertedTrackId}
                    onSelect={(item) =>
                      linkTrack
                        .mutateAsync(item.id)
                        .then(() => setLinking(false))
                        .catch((e) => toast.error(e.message))
                    }
                    placeholder="Pick the library track…"
                    emptyHint="The track appears here after the next Disco sync."
                  />
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => setLinking(true)}
                >
                  {demo.convertedTrackId
                    ? "Change linked track"
                    : "Link library track"}
                </Button>
              )}
            </div>
          )}
        </Panel>

        <Panel title="Invoice">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Link
                href={`/invoices/${demo.invoice.id}`}
                className="text-lg font-semibold underline decoration-border underline-offset-4 hover:decoration-foreground"
              >
                {formatInvoiceNumber(demo.invoice.number)}
              </Link>
              <div className="mt-1 text-xs text-muted-foreground">
                Billed to {demo.invoice.billToName} ·{" "}
                {formatMoney(demo.invoice.amount)}
              </div>
            </div>
            <InvoiceStatusPill status={demo.invoice.status} />
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                downloadFile(
                  `/invoices/${demo.invoice.id}/pdf`,
                  `${formatInvoiceNumber(demo.invoice.number)}.pdf`
                ).catch((e) => toast.error(e.message))
              }
            >
              Download PDF
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href={`/invoices/${demo.invoice.id}`}>Manage →</Link>
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  )
}
