"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  REPORT_BASIS_LABELS,
  REPORT_BASIS_NOTES,
  REPORT_GROUP_BY_LABELS,
  ReportResultSchema,
  addMonths,
  formatMoney,
  todayIso,
  type ReportBasis,
  type ReportGroupBy,
} from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { SegControl } from "@/components/seg-control"
import { PageHeader } from "@/components/shell/page-header"
import { api, downloadFile } from "@/lib/api"

export function ReportsPage() {
  const [from, setFrom] = useState(addMonths(todayIso(), -12))
  const [to, setTo] = useState(todayIso())
  const [groupBy, setGroupBy] = useState<ReportGroupBy>("brand")
  const [basis, setBasis] = useState<ReportBasis>("commitment")
  const [includeLeads, setIncludeLeads] = useState(false)

  const query = { from, to, groupBy, basis, includeLeads }
  const enabled = Boolean(from && to)
  const { data: report, isPending } = useQuery({
    queryKey: ["reports", query],
    queryFn: () => api("/reports/sales", { query, schema: ReportResultSchema }),
    enabled,
  })

  const exportAs = (ext: "csv" | "pdf") =>
    downloadFile(
      `/reports/sales.${ext}?from=${from}&to=${to}&groupBy=${groupBy}&basis=${basis}&includeLeads=${includeLeads}`,
      `sales_${from}_${to}_by_${groupBy}_${basis}.${ext}`
    ).catch((e) => toast.error(e.message))

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Reports" />

      <div className="mb-6 border bg-card p-4 md:p-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
              From
            </label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-2 block text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
              To
            </label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="mb-2 block text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
            Group By
          </label>
          <SegControl
            options={(
              Object.entries(REPORT_GROUP_BY_LABELS) as Array<
                [ReportGroupBy, string]
              >
            ).map(([value, label]) => ({ value, label }))}
            value={groupBy}
            onChange={setGroupBy}
          />
        </div>
        <div className="mt-4">
          <label className="mb-2 block text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
            Basis
          </label>
          <SegControl
            options={(
              Object.entries(REPORT_BASIS_LABELS) as Array<
                [ReportBasis, string]
              >
            ).map(([value, label]) => ({ value, label }))}
            value={basis}
            onChange={setBasis}
          />
          <p className="mt-2 text-[11px] text-muted-foreground">
            {REPORT_BASIS_NOTES[basis]}
          </p>
        </div>
        <label className="mt-4 flex cursor-pointer items-start gap-2.5">
          <Checkbox
            checked={includeLeads}
            onCheckedChange={(v) => setIncludeLeads(v === true)}
            className="mt-0.5"
          />
          <span className="text-sm">Include leads</span>
        </label>
      </div>

      {isPending ? (
        <Skeleton className="h-64" />
      ) : report ? (
        <>
          <div className="border bg-card">
            <table className="w-full border-collapse text-[13.5px]">
              <thead>
                <tr className="border-b border-foreground text-left text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
                  <th className="px-4 py-3 font-medium">
                    {REPORT_GROUP_BY_LABELS[report.groupBy]}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">Invoices</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr
                    key={row.label}
                    className="border-b border-border-soft last:border-0"
                  >
                    <td className="px-4 py-3.5 font-medium">{row.label}</td>
                    <td className="px-4 py-3.5 text-right text-muted-foreground tabular-nums">
                      {row.invoiceCount}
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold tabular-nums">
                      {formatMoney(row.total)}
                    </td>
                  </tr>
                ))}
                {report.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-10 text-center text-sm text-muted-foreground"
                    >
                      {report.basis === "cash"
                        ? "No paid invoices in this range."
                        : "No invoices issued in this range."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
              {report.rows.length > 0 ? (
                <tfoot>
                  <tr className="border-t border-foreground">
                    <td className="px-4 py-3.5 text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
                      Sales · {report.invoiceCount}{" "}
                      {report.basis === "cash" ? "paid invoices" : "invoices"}
                    </td>
                    <td />
                    <td className="px-4 py-3.5 text-right font-heading text-lg tracking-tight">
                      {formatMoney(report.grandTotal)}
                    </td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>

          {report.groupBy === "usage_type" && report.rows.length > 0 ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              A license can grant several media, so each fee counts toward every
              usage row. The rows will overlap and sum to more than the grand
              total.
            </p>
          ) : null}

          {report.includeLeads ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Totals include {formatMoney(report.leadTotal)} from
              personal-ledger leads (blended into the rows above). Leads are
              commitment-basis and may double-count invoiced fees.
            </p>
          ) : null}

          {/* Royalties: a separate section — received income by payer, never
              blended into the sales groupings above (ADR-0009). */}
          {report.royaltyRows.length > 0 ? (
            <div className="mt-6 border bg-card">
              <table className="w-full border-collapse text-[13.5px]">
                <thead>
                  <tr className="border-b border-foreground text-left text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
                    <th className="px-4 py-3 font-medium">
                      Royalties · By Payer
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      Payments
                    </th>
                    <th className="px-4 py-3 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {report.royaltyRows.map((row) => (
                    <tr
                      key={row.label}
                      className="border-b border-border-soft last:border-0"
                    >
                      <td className="px-4 py-3.5 font-medium">{row.label}</td>
                      <td className="px-4 py-3.5 text-right text-muted-foreground tabular-nums">
                        {row.paymentCount}
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold tabular-nums">
                        {formatMoney(row.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-foreground">
                    <td className="px-4 py-3.5 text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
                      Royalties · {report.royaltyPaymentCount} payments
                    </td>
                    <td />
                    <td className="px-4 py-3.5 text-right font-heading text-lg tracking-tight">
                      {formatMoney(report.royaltyTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : null}

          {report.rows.length > 0 || report.royaltyRows.length > 0 ? (
            <div className="mt-6 flex items-baseline justify-between border border-foreground bg-card px-4 py-3.5">
              <span className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
                Total income · Sales + Royalties
              </span>
              <span className="font-heading text-xl tracking-tight">
                {formatMoney(report.totalIncome)}
              </span>
            </div>
          ) : null}

          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void exportAs("csv")}
            >
              Export CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void exportAs("pdf")}
            >
              Export PDF
            </Button>
          </div>
        </>
      ) : null}
    </div>
  )
}
