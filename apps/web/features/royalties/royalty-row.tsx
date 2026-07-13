"use client"

import { useState } from "react"
import { Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { formatMoney, type RoyaltyPaymentDto } from "@workspace/shared"
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
import { useDeleteRoyalty } from "./hooks"
import { RoyaltyComposer } from "./royalty-composer"

/** Day-and-month only — the year lives in the month group header. */
function dayLabel(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

function LinkBadges({ royalty }: { royalty: RoyaltyPaymentDto }) {
  const links = [
    royalty.brandName,
    royalty.trackName,
    royalty.licenseLabel,
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

export function RoyaltyRow({ royalty }: { royalty: RoyaltyPaymentDto }) {
  const [editing, setEditing] = useState(false)
  const del = useDeleteRoyalty()

  if (editing) {
    return (
      <RoyaltyComposer
        mode="edit"
        royalty={royalty}
        onDone={() => setEditing(false)}
      />
    )
  }

  return (
    <div className="group flex items-start gap-3 border bg-card p-3 transition-colors hover:bg-black/[0.015] md:gap-4">
      <span className="w-14 shrink-0 pt-0.5 text-[11px] tracking-[0.04em] text-muted-foreground tabular-nums uppercase md:w-16">
        {dayLabel(royalty.date)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">
          <span className="font-semibold">{royalty.payerName}</span>
          {royalty.description ? (
            <span className="text-muted-foreground">
              {" · "}
              {royalty.description}
            </span>
          ) : null}
        </span>
        <LinkBadges royalty={royalty} />
      </span>
      <span className="pt-0.5 text-sm font-semibold tabular-nums">
        {formatMoney(royalty.amount)}
      </span>
      <span className="flex shrink-0 items-center">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Edit royalty payment"
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
              aria-label="Delete royalty payment"
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this royalty payment?</AlertDialogTitle>
              <AlertDialogDescription>
                {royalty.payerName}
                {royalty.description ? ` · ${royalty.description}` : ""} ·{" "}
                {formatMoney(royalty.amount)}. This can&apos;t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() =>
                  del.mutate(royalty.id, {
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
