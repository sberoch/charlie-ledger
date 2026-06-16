"use client"

import { useRef, useState } from "react"
import { Link2, Plus } from "lucide-react"
import { toast } from "sonner"
import { todayIso, type LeadDto } from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import { useCreateLead, useUpdateLead } from "./hooks"
import { LeadLinks, type LeadLinkValue } from "./lead-links"

interface Draft extends LeadLinkValue {
  date: string
  description: string
  amount: string
}

const AMOUNT_RE = /^-?\d+(\.\d{1,2})?$/

function emptyDraft(date?: string): Draft {
  return {
    date: date ?? todayIso(),
    description: "",
    amount: "",
    brandId: null,
    licenseId: null,
    demoId: null,
  }
}

function fromLead(lead: LeadDto): Draft {
  return {
    date: lead.date,
    description: lead.description,
    amount: lead.amount,
    brandId: lead.brandId,
    licenseId: lead.licenseId,
    demoId: lead.demoId,
  }
}

/**
 * The pinned quick-add row (and, in edit mode, an inline editor). Mobile-first:
 * the common path is description → amount → Add, and after each add the row
 * resets — keeping the entered date — and refocuses Description without blurring,
 * so the keyboard stays up for the next entry in succession.
 */
export function LeadComposer({
  mode,
  lead,
  onDone,
}: {
  mode: "create" | "edit"
  lead?: LeadDto
  onDone?: () => void
}) {
  const [draft, setDraft] = useState<Draft>(
    mode === "edit" && lead ? fromLead(lead) : emptyDraft()
  )
  const [linksOpen, setLinksOpen] = useState(
    mode === "edit" && lead
      ? Boolean(lead.brandId || lead.licenseId || lead.demoId)
      : false
  )
  const descRef = useRef<HTMLInputElement>(null)
  const create = useCreateLead()
  const update = useUpdateLead(lead?.id ?? "")
  const pending = create.isPending || update.isPending

  const amount = draft.amount.replace(/[,\s]/g, "")
  const valid =
    Boolean(draft.date) &&
    draft.description.trim().length > 0 &&
    AMOUNT_RE.test(amount)
  const linkCount = [draft.brandId, draft.licenseId, draft.demoId].filter(
    Boolean
  ).length

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || pending) return
    const payload = {
      date: draft.date,
      description: draft.description.trim(),
      amount,
      brandId: draft.brandId,
      licenseId: draft.licenseId,
      demoId: draft.demoId,
    }

    if (mode === "edit") {
      update.mutate(payload, {
        onSuccess: () => onDone?.(),
        onError: (err) => toast.error(err.message),
      })
      return
    }

    // Optimistic reset within the submit gesture so the keyboard never drops:
    // clear the row (keeping the date for back-to-back entries) and refocus.
    create.mutate(payload, { onError: (err) => toast.error(err.message) })
    setDraft(emptyDraft(draft.date))
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
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <Input
          type="date"
          aria-label="Date"
          value={draft.date}
          onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
          className="md:w-40"
        />
        <Input
          ref={descRef}
          placeholder="Description"
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
        <LeadLinks
          value={draft}
          onChange={(next) => setDraft((d) => ({ ...d, ...next }))}
        />
      ) : null}
    </form>
  )
}
