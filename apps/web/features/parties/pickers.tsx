"use client"

import { useState } from "react"
import { toast } from "sonner"
import type { BrandDto, PayerDto } from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { EntityCombobox } from "./entity-combobox"
import {
  useBrands,
  useCategories,
  useCreateBrand,
  useCreateCategory,
  useCreatePayer,
  usePayers,
} from "./hooks"

function CreateBox({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="mt-2 border border-dashed bg-secondary/60 p-3">
      <div className="mb-2.5 text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
        {title}
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  )
}

/** Brand pick-or-create. Creation requires a Category (one combobox more —
 *  the per-category analytics depend on it being required). */
export function BrandPicker({
  value,
  onChange,
}: {
  value: string | null
  onChange: (brand: BrandDto | null) => void
}) {
  const { data: brands = [] } = useBrands()
  const { data: categories = [] } = useCategories()
  const createBrand = useCreateBrand()
  const createCategory = useCreateCategory()
  const [pendingName, setPendingName] = useState<string | null>(null)
  const [categoryId, setCategoryId] = useState<string | null>(null)

  const confirmCreate = async () => {
    if (!pendingName || !categoryId) return
    const brand = await createBrand.mutateAsync({
      name: pendingName,
      categoryId,
    })
    onChange(brand)
    setPendingName(null)
    setCategoryId(null)
  }

  return (
    <div>
      <EntityCombobox
        items={brands.map((b) => ({
          id: b.id,
          name: b.name,
          meta: b.categoryName,
        }))}
        value={value}
        onSelect={(item) => {
          onChange(brands.find((b) => b.id === item.id) ?? null)
          setPendingName(null)
        }}
        onCreate={(name) => setPendingName(name)}
        placeholder="Select brand…"
        emptyHint="Type to search or type a new name to create it."
      />
      {pendingName !== null ? (
        <CreateBox title={`New brand “${pendingName}”`}>
          <EntityCombobox
            items={categories.map((c) => ({ id: c.id, name: c.name }))}
            value={categoryId}
            onSelect={(item) => setCategoryId(item.id)}
            onCreate={async (name) => {
              const category = await createCategory.mutateAsync(name)
              setCategoryId(category.id)
            }}
            placeholder="Category (required)…"
            emptyHint="Type a new category name to create it."
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!categoryId || createBrand.isPending}
              onClick={() =>
                void confirmCreate().catch((e) => toast.error(e.message))
              }
            >
              Create brand
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setPendingName(null)}
            >
              Cancel
            </Button>
          </div>
        </CreateBox>
      ) : null}
    </div>
  )
}

/** Payer pick-or-create. Creation exposes email + billing address right here:
 *  the invoice snapshots the bill-to block the moment the source is created,
 *  so there is no later step where these could be filled in. */
export function PayerPicker({
  value,
  onChange,
  suggestedName,
}: {
  value: string | null
  onChange: (payer: PayerDto | null) => void
  /** The selected Brand's name — direct pays dominate, so offer one-tap reuse. */
  suggestedName?: string
}) {
  const { data: payers = [] } = usePayers()
  const createPayer = useCreatePayer()
  const [pendingName, setPendingName] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [address, setAddress] = useState("")

  const selected = payers.find((p) => p.id === value)

  const confirmCreate = async (name: string) => {
    const payer = await createPayer.mutateAsync({
      name,
      email: email.trim() || null,
      address: address.trim() || null,
    })
    onChange(payer)
    setPendingName(null)
    setEmail("")
    setAddress("")
  }

  const useSuggested = () => {
    const existing = payers.find(
      (p) => p.name.toLowerCase() === suggestedName!.toLowerCase()
    )
    if (existing) onChange(existing)
    else setPendingName(suggestedName!)
  }

  return (
    <div>
      <EntityCombobox
        items={payers.map((p) => ({
          id: p.id,
          name: p.name,
          meta: p.email ?? undefined,
        }))}
        value={value}
        onSelect={(item) => {
          onChange(payers.find((p) => p.id === item.id) ?? null)
          setPendingName(null)
        }}
        onCreate={(name) => setPendingName(name)}
        placeholder="Select payer…"
        emptyHint="Type to search or type a new name to create it."
      />

      {suggestedName && !pendingName && selected?.name !== suggestedName ? (
        <button
          type="button"
          onClick={useSuggested}
          className="mt-2 cursor-pointer border border-dashed px-2.5 py-1.5 text-xs text-ink-soft hover:border-foreground hover:text-foreground"
        >
          Use “{suggestedName}” as payer
        </button>
      ) : null}

      {pendingName !== null ? (
        <CreateBox title={`New payer “${pendingName}”`}>
          <Input
            type="email"
            placeholder="Billing email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Textarea
            placeholder={
              "Billing address (optional)\nLands on the invoice PDF verbatim"
            }
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={3}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={createPayer.isPending}
              onClick={() =>
                void confirmCreate(pendingName).catch((e) =>
                  toast.error(e.message)
                )
              }
            >
              Create payer
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setPendingName(null)}
            >
              Cancel
            </Button>
          </div>
        </CreateBox>
      ) : null}

      {selected && !selected.email && !selected.address ? (
        <p className="mt-1.5 text-[11px] text-ochre">
          No billing details on file — the invoice bill-to will only carry the
          name.
        </p>
      ) : null}
    </div>
  )
}
