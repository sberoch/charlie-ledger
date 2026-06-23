"use client"

import { useState } from "react"
import { Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { formatMoney, type LeadDto } from "@workspace/shared"
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
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { useDeleteLead } from "./hooks"
import { LeadComposer } from "./lead-composer"

/** Day-and-month only — the year lives in the month group header. */
function dayLabel(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

function LinkBadges({ lead }: { lead: LeadDto }) {
  const links = [
    lead.brandName,
    lead.licenseLabel,
    lead.demoLabel,
    lead.trackName,
  ].filter(Boolean) as string[]
  if (links.length === 0) return null
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {links.map((label) => (
        <Badge key={label} variant="tag" className="max-w-[14rem] truncate">
          {label}
        </Badge>
      ))}
    </span>
  )
}

export function LeadRow({ lead }: { lead: LeadDto }) {
  const [editing, setEditing] = useState(false)
  const del = useDeleteLead()
  const negative = Number(lead.amount) < 0

  if (editing) {
    return <LeadComposer mode="edit" lead={lead} onDone={() => setEditing(false)} />
  }

  return (
    <div className="group flex items-start gap-3 border bg-card p-3 transition-colors hover:bg-black/[0.015] md:gap-4">
      <span className="w-14 shrink-0 pt-0.5 text-[11px] tracking-[0.04em] text-muted-foreground tabular-nums uppercase md:w-16">
        {dayLabel(lead.date)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{lead.description}</span>
        <LinkBadges lead={lead} />
      </span>
      <span
        className={cn(
          "pt-0.5 text-sm font-semibold tabular-nums",
          negative && "text-rust"
        )}
      >
        {formatMoney(lead.amount)}
      </span>
      <span className="flex shrink-0 items-center">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Edit lead"
          onClick={() => setEditing(true)}
        >
          <Pencil />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Delete lead"
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
              <AlertDialogDescription>
                {lead.description} · {formatMoney(lead.amount)}. This can&apos;t
                be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() =>
                  del.mutate(lead.id, {
                    onError: (err) => toast.error(err.message),
                  })
                }
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </span>
    </div>
  )
}
