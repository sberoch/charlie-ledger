"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { formatInvoiceNumber, formatMoney, todayIso } from "@workspace/shared"
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
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Panel } from "@/components/panel"
import { InvoiceStatusPill } from "@/components/pills"
import { downloadFile } from "@/lib/api"
import { formatDate } from "@/lib/format"
import {
  useClearPaid,
  useInvoice,
  useMarkPaid,
  useVoidAndReissue,
} from "./hooks"

export function InvoiceDetailPage({ id }: { id: string }) {
  const router = useRouter()
  const { data: invoice, isPending } = useInvoice(id)
  const markPaid = useMarkPaid(id)
  const clearPaid = useClearPaid(id)
  const voidAndReissue = useVoidAndReissue(id)
  const [paidDate, setPaidDate] = useState(todayIso())

  if (isPending || !invoice) return <Skeleton className="h-64" />

  const sourceHref =
    invoice.source.kind === "license"
      ? `/licenses/${invoice.source.id}`
      : `/demos/${invoice.source.id}`

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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            downloadFile(
              `/invoices/${id}/pdf`,
              `${formatInvoiceNumber(invoice.number)}.pdf`
            ).catch((e) => toast.error(e.message))
          }
        >
          Download PDF
        </Button>
      </div>

      <div className="mb-6 flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-heading text-3xl tracking-tight">
            {formatInvoiceNumber(invoice.number)}
          </h1>
          <div className="mt-2.5 flex items-center gap-2.5">
            <InvoiceStatusPill status={invoice.status} />
            <Link
              href={sourceHref}
              className="text-xs tracking-[0.06em] text-ink-soft uppercase underline decoration-border underline-offset-3 hover:text-foreground"
            >
              {invoice.source.title} →
            </Link>
          </div>
        </div>
        <div className="md:text-right">
          <div className="font-heading text-3xl tracking-tight">
            {formatMoney(invoice.amount)}
          </div>
          <div className="mt-1.5 text-[11px] tracking-[0.1em] text-muted-foreground uppercase">
            issued {formatDate(invoice.issueDate)} · due{" "}
            {formatDate(invoice.dueDate)}
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Panel title="Bill To · Snapshot">
          <div className="text-sm leading-relaxed">
            <div className="font-semibold">{invoice.billToName}</div>
            {invoice.billToAddress ? (
              <div className="mt-1 whitespace-pre-line text-ink-soft">
                {invoice.billToAddress}
              </div>
            ) : null}
            {invoice.billToEmail ? (
              <div className="mt-1 text-ink-soft">{invoice.billToEmail}</div>
            ) : null}
          </div>
        </Panel>

        <Panel title="Payment">
          {invoice.status === "voided" ? (
            <p className="text-sm text-muted-foreground">
              Voided{" "}
              {invoice.voidedAt
                ? formatDate(invoice.voidedAt.slice(0, 10))
                : ""}{" "}
              — replaced by a reissued invoice.
            </p>
          ) : invoice.paidDate ? (
            <div>
              <p className="text-sm">
                Paid <strong>{formatDate(invoice.paidDate)}</strong>
              </p>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Anchors the cash-basis sales reports.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() =>
                  clearPaid
                    .mutateAsync()
                    .then(() => toast.success("Paid date cleared"))
                    .catch((e) => toast.error(e.message))
                }
              >
                Clear paid date
              </Button>
            </div>
          ) : (
            <div>
              <label className="mb-2 block text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
                Paid date
              </label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={paidDate}
                  onChange={(e) => setPaidDate(e.target.value)}
                  className="max-w-44"
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-10"
                  disabled={markPaid.isPending || !paidDate}
                  onClick={() =>
                    markPaid
                      .mutateAsync(paidDate)
                      .then(() => toast.success("Marked paid"))
                      .catch((e) => toast.error(e.message))
                  }
                >
                  Mark paid
                </Button>
              </div>
            </div>
          )}

          {invoice.status !== "voided" ? (
            <div className="mt-5 border-t border-border-soft pt-4">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={invoice.status === "paid"}
                  >
                    Void &amp; reissue
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Void {formatInvoiceNumber(invoice.number)} and reissue?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This invoice will be voided (its number is kept, it drops
                      out of receivables) and a replacement issued under the
                      next number with a fresh snapshot of the source&apos;s
                      current payer and fee.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        voidAndReissue
                          .mutateAsync({})
                          .then((next) => {
                            toast.success(
                              `Reissued as ${formatInvoiceNumber(next.number)}`
                            )
                            router.push(`/invoices/${next.id}`)
                          })
                          .catch((e) => toast.error(e.message))
                      }
                    >
                      Void &amp; reissue
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              {invoice.status === "paid" ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  A paid invoice can&apos;t be voided. Clear its paid date
                  first.
                </p>
              ) : null}
            </div>
          ) : null}
        </Panel>
      </div>

      <Panel title="Description" className="mt-5">
        <p className="text-sm leading-relaxed">{invoice.description}</p>
      </Panel>
    </div>
  )
}
