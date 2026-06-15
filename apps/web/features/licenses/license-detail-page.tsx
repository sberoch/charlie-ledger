"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  EXCLUSIVITY_TIER_LABELS,
  TERM_LENGTH_LABELS,
  formatUsageTypes,
  formatInvoiceNumber,
  formatMoney,
} from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { InvoiceStatusPill, UrgencyPill } from "@/components/pills"
import { Panel } from "@/components/panel"
import { EntityCombobox } from "@/features/parties/entity-combobox"
import { downloadFile } from "@/lib/api"
import { formatDate } from "@/lib/format"
import { useLicense, useLicenses, useSetRenewedTo } from "./hooks"

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

export function LicenseDetailPage({ id }: { id: string }) {
  const router = useRouter()
  const { data: license, isPending } = useLicense(id)
  const { data: allLicenses } = useLicenses()
  const setRenewedTo = useSetRenewedTo(id)
  const [pickingRenewal, setPickingRenewal] = useState(false)

  if (isPending || !license) return <Skeleton className="h-64" />

  const renewalCandidates = (allLicenses ?? []).filter(
    (l) => l.id !== id && l.trackId === license.trackId
  )

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="cursor-pointer text-xs text-ink-soft underline decoration-border underline-offset-3 hover:text-foreground"
        >
          ← Back
        </button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/licenses/${id}/edit`}>Edit License</Link>
        </Button>
      </div>

      <div className="mb-6 flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-heading text-2xl tracking-tight md:text-3xl">
            <Link
              href={`/tracks/${license.trackId}`}
              className="hover:underline"
            >
              {license.trackName}
            </Link>
            <span className="mx-2 text-muted-foreground">×</span>
            {license.brandName}
          </h1>
          <div className="mt-2.5 flex items-center gap-2.5">
            <UrgencyPill endDate={license.endDate} />
            <span className="text-xs tracking-[0.08em] text-muted-foreground uppercase">
              {license.categoryName}
            </span>
          </div>
        </div>
        <div className="md:text-right">
          <div className="font-heading text-3xl tracking-tight">
            {formatMoney(license.fee)}
          </div>
          <div className="mt-1.5 text-[11px] tracking-[0.1em] text-muted-foreground uppercase">
            Fee · commitment basis
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-4">
        <Fact label="Usage">{formatUsageTypes(license.usageTypes)}</Fact>
        <Fact label="Term">{TERM_LENGTH_LABELS[license.termLength]}</Fact>
        <Fact label="Exclusivity">
          {EXCLUSIVITY_TIER_LABELS[license.exclusivityTier]}
        </Fact>
        <Fact label="Payer">{license.payerName}</Fact>
        <Fact label="Start">{formatDate(license.startDate)}</Fact>
        <Fact label="End">
          {license.endDate ? formatDate(license.endDate) : "Perpetual"}
        </Fact>
        {license.notes ? (
          <div className="col-span-2">
            <Fact label="Notes">{license.notes}</Fact>
          </div>
        ) : null}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Panel title="Invoice">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Link
                href={`/invoices/${license.invoice.id}`}
                className="text-lg font-semibold underline decoration-border underline-offset-4 hover:decoration-foreground"
              >
                {formatInvoiceNumber(license.invoice.number)}
              </Link>
              <div className="mt-1 text-xs text-muted-foreground">
                Billed to {license.invoice.billToName} ·{" "}
                {formatMoney(license.invoice.amount)}
              </div>
            </div>
            <InvoiceStatusPill status={license.invoice.status} />
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                downloadFile(
                  `/invoices/${license.invoice.id}/pdf`,
                  `${formatInvoiceNumber(license.invoice.number)}.pdf`
                ).catch((e) => toast.error(e.message))
              }
            >
              Download PDF
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href={`/invoices/${license.invoice.id}`}>Manage →</Link>
            </Button>
          </div>
          {license.invoices.length > 1 ? (
            <div className="mt-4 border-t border-border-soft pt-3 text-xs text-muted-foreground">
              History:{" "}
              {license.invoices
                .map((inv) =>
                  inv.status === "voided"
                    ? `${formatInvoiceNumber(inv.number)} (void)`
                    : formatInvoiceNumber(inv.number)
                )
                .join(" · ")}
            </div>
          ) : null}
        </Panel>

        <Panel title="Renewal">
          {license.renewedTo ? (
            <p className="text-sm leading-relaxed">
              Renewed →{" "}
              <Link
                href={`/licenses/${license.renewedTo.id}`}
                className="font-semibold underline decoration-border underline-offset-3 hover:decoration-foreground"
              >
                {license.trackName} × {license.renewedTo.brandName}
              </Link>
              <span className="block pt-1 text-xs text-muted-foreground">
                starts {formatDate(license.renewedTo.startDate)}
              </span>
            </p>
          ) : pickingRenewal ? (
            <div>
              <EntityCombobox
                items={renewalCandidates.map((l) => ({
                  id: l.id,
                  name: `${l.trackName} × ${l.brandName}`,
                  meta: l.startDate,
                }))}
                value={null}
                onSelect={(item) =>
                  setRenewedTo
                    .mutateAsync(item.id)
                    .then(() => setPickingRenewal(false))
                    .catch((e) => toast.error(e.message))
                }
                placeholder="Pick the replacing license…"
                emptyHint="Create the new license first, then point this one at it."
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="mt-2"
                onClick={() => setPickingRenewal(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Renewals are new licenses. Create one, then link it here for the
                succession chain.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => setPickingRenewal(true)}
              >
                Link renewal →
              </Button>
            </div>
          )}
          {license.renewedFrom.length > 0 ? (
            <div className="mt-4 border-t border-border-soft pt-3 text-xs text-muted-foreground">
              Renews:{" "}
              {license.renewedFrom.map((from, i) => (
                <span key={from.id}>
                  {i > 0 ? " · " : ""}
                  <Link
                    href={`/licenses/${from.id}`}
                    className="underline decoration-border underline-offset-3 hover:text-foreground"
                  >
                    {from.brandName}
                    {from.endDate ? ` (ended ${formatDate(from.endDate)})` : ""}
                  </Link>
                </span>
              ))}
            </div>
          ) : null}
        </Panel>
      </div>
    </div>
  )
}
