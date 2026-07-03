"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  AppSettingsSchema,
  formatInvoiceNumber,
  type AppSettingsDto,
  type UpdateAppSettingsInput,
} from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Panel } from "@/components/panel"
import { api } from "@/lib/api"

function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => api("/settings", { schema: AppSettingsSchema }),
  })
}

export function GeneralPanel() {
  const queryClient = useQueryClient()
  const { data: settings } = useSettings()

  const [lookahead, setLookahead] = useState<string | null>(null)
  const [nextNumber, setNextNumber] = useState<string | null>(null)

  const updateSettings = useMutation({
    mutationFn: (input: UpdateAppSettingsInput) =>
      api<AppSettingsDto>("/settings", {
        method: "PATCH",
        body: input,
        schema: AppSettingsSchema,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings"] })
      toast.success("Settings saved")
      setLookahead(null)
      setNextNumber(null)
    },
    onError: (e) => toast.error(e.message),
  })

  if (!settings) return <Skeleton className="h-64" />

  return (
    <div className="flex flex-col gap-5">
      <Panel title="Weekly Digest">
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          Mondays 7:00am EST. Licenses expiring, holds lifting, overdue
          invoices within the look-ahead window.
        </p>
        <div className="flex items-end gap-2">
          <div>
            <label className="mb-2 block text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
              Look-ahead · days
            </label>
            <Input
              type="number"
              min={1}
              max={90}
              value={lookahead ?? String(settings.digestLookaheadDays)}
              onChange={(e) => setLookahead(e.target.value)}
              className="max-w-28"
            />
          </div>
          <Button
            type="button"
            size="sm"
            className="h-10"
            disabled={lookahead === null || updateSettings.isPending}
            onClick={() =>
              updateSettings.mutate({
                digestLookaheadDays: Number(lookahead),
              })
            }
          >
            Save
          </Button>
        </div>
      </Panel>

      <Panel title="Invoice Numbering">
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          Next number to be issued:{" "}
          <strong className="text-foreground">
            {formatInvoiceNumber(settings.nextInvoiceNumber)}
          </strong>
          . Move it forward to continue an existing sequence (e.g. where
          QuickBooks left off). It can never rewind below an issued number.
        </p>
        <div className="flex items-end gap-2">
          <div>
            <label className="mb-2 block text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
              Next invoice number
            </label>
            <Input
              type="number"
              min={1}
              value={nextNumber ?? String(settings.nextInvoiceNumber)}
              onChange={(e) => setNextNumber(e.target.value)}
              className="max-w-28"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-10"
            disabled={nextNumber === null || updateSettings.isPending}
            onClick={() =>
              updateSettings.mutate({ nextInvoiceNumber: Number(nextNumber) })
            }
          >
            Save
          </Button>
        </div>
      </Panel>
    </div>
  )
}
