"use client"

import { useEffect, useRef, useState } from "react"
import { Link2, Plus } from "lucide-react"
import { toast } from "sonner"
import { todayIso, type RoyaltyPaymentDto } from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import { PayerPicker } from "@/features/parties/pickers"
import { useCreateRoyalty, useUpdateRoyalty } from "./hooks"
import { RoyaltyLinks, type RoyaltyLinkValue } from "./royalty-links"

interface Draft extends RoyaltyLinkValue {
  date: string
  payerId: string | null
  description: string
  amount: string
}

// Non-negative — royalties are received money; zero is allowed (a royalty
// event that paid nothing is still faithful history).
const AMOUNT_RE = /^\d+(\.\d{1,2})?$/

function emptyDraft(keep?: { date: string; payerId: string | null }): Draft {
  return {
    date: keep?.date ?? todayIso(),
    payerId: keep?.payerId ?? null,
    description: "",
    amount: "",
    brandId: null,
    trackId: null,
    licenseId: null,
  }
}

function fromRoyalty(royalty: RoyaltyPaymentDto): Draft {
  return {
    date: royalty.date,
    payerId: royalty.payerId,
    description: royalty.description ?? "",
    amount: royalty.amount,
    brandId: royalty.brandId,
    trackId: royalty.trackId,
    licenseId: royalty.licenseId,
  }
}

/**
 * The pinned quick-add row (and, in edit mode, an inline editor) — the Lead
 * composer pattern. After each add the row resets KEEPING the date and the
 * payer and refocuses Description without blurring, so a BMI statement
 * (Writers + Publishing) is two quick entries in succession.
 */
export function RoyaltyComposer({
  mode,
  royalty,
  onDone,
}: {
  mode: "create" | "edit"
  royalty?: RoyaltyPaymentDto
  onDone?: () => void
}) {
  const [draft, setDraft] = useState<Draft>(
    mode === "edit" && royalty ? fromRoyalty(royalty) : emptyDraft()
  )
  const [linksOpen, setLinksOpen] = useState(
    mode === "edit" && royalty
      ? Boolean(royalty.brandId || royalty.trackId || royalty.licenseId)
      : false
  )
  const descRef = useRef<HTMLInputElement>(null)
  const create = useCreateRoyalty()
  const update = useUpdateRoyalty(royalty?.id ?? "")
  const pending = create.isPending || update.isPending

  // The mobile FAB deep-links here as /royalties#add — land ready to type.
  useEffect(() => {
    if (mode === "create" && window.location.hash === "#add")
      descRef.current?.focus()
  }, [mode])

  const amount = draft.amount.replace(/[,\s$]/g, "")
  const valid =
    Boolean(draft.date) && Boolean(draft.payerId) && AMOUNT_RE.test(amount)
  const linkCount = [draft.brandId, draft.trackId, draft.licenseId].filter(
    Boolean
  ).length

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || pending) return
    const payload = {
      date: draft.date,
      payerId: draft.payerId!,
      description: draft.description.trim() || null,
      amount,
      brandId: draft.brandId,
      trackId: draft.trackId,
      licenseId: draft.licenseId,
    }

    if (mode === "edit") {
      update.mutate(payload, {
        onSuccess: () => onDone?.(),
        onError: (err) => toast.error(err.message),
      })
      return
    }

    // Optimistic reset within the submit gesture so the keyboard never drops:
    // clear the row — keeping date AND payer for the Writers/Publishing pair —
    // and refocus.
    create.mutate(payload, { onError: (err) => toast.error(err.message) })
    setDraft(emptyDraft({ date: draft.date, payerId: draft.payerId }))
    setLinksOpen(false)
    descRef.current?.focus()
  }

  return (
    <form
      onSubmit={submit}
      className={cn(
        "border bg-card p-3",
        mode === "create" && "border-foreground/15"
      )}
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-start">
        <Input
          type="date"
          aria-label="Date"
          value={draft.date}
          onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
          className="md:w-40"
        />
        <div className="md:w-56">
          <PayerPicker
            value={draft.payerId}
            onChange={(payer) =>
              setDraft((d) => ({ ...d, payerId: payer?.id ?? null }))
            }
          />
        </div>
        <Input
          ref={descRef}
          placeholder="Description (optional)"
          value={draft.description}
          onChange={(e) =>
            setDraft((d) => ({ ...d, description: e.target.value }))
          }
          className="md:flex-1"
        />
        <div className="flex gap-2">
          <Input
            inputMode="decimal"
            placeholder="Amount"
            value={draft.amount}
            onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
            className="flex-1 text-right tabular-nums md:w-32"
          />
          <Button type="submit" disabled={!valid || pending} className="shrink-0">
            {mode === "create" ? (
              <>
                <Plus /> Add
              </>
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setLinksOpen((o) => !o)}
          className={cn(
            "flex items-center gap-1 text-[11px] tracking-[0.08em] text-muted-foreground uppercase transition-colors hover:text-foreground",
            linkCount > 0 && "text-foreground"
          )}
        >
          <Link2 className="size-3.5" />
          {linkCount > 0
            ? `${linkCount} link${linkCount > 1 ? "s" : ""}`
            : "Add link"}
        </button>
        {mode === "edit" ? (
          <button
            type="button"
            onClick={() => onDone?.()}
            className="ml-auto text-[11px] tracking-[0.08em] text-muted-foreground uppercase transition-colors hover:text-foreground"
          >
            Cancel
          </button>
        ) : null}
      </div>

      {linksOpen ? (
        <RoyaltyLinks
          value={draft}
          onChange={(next) => setDraft((d) => ({ ...d, ...next }))}
        />
      ) : null}
    </form>
  )
}
