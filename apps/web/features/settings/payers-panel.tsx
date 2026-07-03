"use client"

import { useState } from "react"
import { Pencil } from "lucide-react"
import { toast } from "sonner"
import type { PayerDto } from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Textarea } from "@workspace/ui/components/textarea"
import { Panel } from "@/components/panel"
import { usePayers, useUpdatePayer } from "@/features/parties/hooks"

function PayerRow({ payer }: { payer: PayerDto }) {
  const update = useUpdatePayer()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(payer.name)
  const [email, setEmail] = useState(payer.email ?? "")
  const [address, setAddress] = useState(payer.address ?? "")

  const save = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    update.mutate(
      {
        id: payer.id,
        name: trimmed,
        email: email.trim() || null,
        address: address.trim() || null,
      },
      {
        onSuccess: () => {
          setEditing(false)
          toast.success("Payer saved")
        },
        onError: (e) => toast.error(e.message),
      }
    )
  }

  if (editing) {
    return (
      <div className="border-b border-border-soft py-3 last:border-0">
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-2.5 md:flex-row">
            <Input
              autoFocus
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              type="email"
              placeholder="Billing email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Textarea
            placeholder="Billing address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={2}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={update.isPending || !name.trim()}
              onClick={save}
            >
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false)
                setName(payer.name)
                setEmail(payer.email ?? "")
                setAddress(payer.address ?? "")
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const hasBilling = Boolean(payer.email) || Boolean(payer.address)

  return (
    <div className="group flex items-center justify-between gap-2 border-b border-border-soft py-2.5 text-sm last:border-0">
      <span className="min-w-0">
        <span className="block truncate font-medium">{payer.name}</span>
        {hasBilling ? (
          <span className="block truncate text-xs text-muted-foreground">
            {[payer.email, payer.address].filter(Boolean).join(" · ")}
          </span>
        ) : (
          <span className="block text-xs text-ochre">
            No billing details on file — invoices carry the name only.
          </span>
        )}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Edit ${payer.name}`}
        className="shrink-0"
        onClick={() => {
          setName(payer.name)
          setEmail(payer.email ?? "")
          setAddress(payer.address ?? "")
          setEditing(true)
        }}
      >
        <Pencil />
      </Button>
    </div>
  )
}

export function PayersPanel() {
  const { data: payers } = usePayers()

  const missing = (payers ?? []).filter((p) => !p.email && !p.address).length

  return (
    <Panel title={`Payers · ${payers?.length ?? "…"}`}>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        The bill-to block (email, address) is snapshotted onto each invoice
        when it&apos;s issued — filling it in here covers future invoices only.
        {missing > 0 ? (
          <>
            {" "}
            <span className="text-ochre">
              {missing} without billing details
            </span>
            .
          </>
        ) : null}
      </p>

      {payers ? (
        <div className="flex max-h-[32rem] flex-col overflow-y-auto">
          {[...payers]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((payer) => (
              <PayerRow key={payer.id} payer={payer} />
            ))}
        </div>
      ) : (
        <Skeleton className="h-48" />
      )}
    </Panel>
  )
}
