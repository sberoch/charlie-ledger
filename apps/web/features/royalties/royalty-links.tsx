"use client"

import { X } from "lucide-react"
import { formatMoney } from "@workspace/shared"
import { useLicenses } from "@/features/licenses/hooks"
import { useBrands } from "@/features/parties/hooks"
import { useTracks } from "@/features/tracks/hooks"
import { EntityCombobox } from "@/features/parties/entity-combobox"

export interface RoyaltyLinkValue {
  brandId: string | null
  trackId: string | null
  licenseId: string | null
}

/** A labelled combobox + a clear button. The Lead trio pattern, minus Demo:
 *  royalties trace to catalog work, never to a demo. Links are pick-only —
 *  context for click-through, never a reporting foundation (ADR-0009). */
function LinkRow({
  label,
  items,
  value,
  onChange,
  placeholder,
}: {
  label: string
  items: Array<{ id: string; name: string; meta?: string }>
  value: string | null
  onChange: (id: string | null) => void
  placeholder: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
          {label}
        </span>
        {value ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="flex items-center gap-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-3" /> Clear
          </button>
        ) : null}
      </div>
      <EntityCombobox
        items={items}
        value={value}
        onSelect={(item) => onChange(item.id)}
        placeholder={placeholder}
        emptyHint="Nothing found."
      />
    </div>
  )
}

export function RoyaltyLinks({
  value,
  onChange,
}: {
  value: RoyaltyLinkValue
  onChange: (next: RoyaltyLinkValue) => void
}) {
  const { data: brands = [] } = useBrands()
  const { data: licenses = [] } = useLicenses()
  const { data: tracks = [] } = useTracks()

  return (
    <div className="mt-3 grid gap-3 border-t border-dashed pt-3 md:grid-cols-3">
      <LinkRow
        label="Brand"
        placeholder="Link a brand…"
        items={brands.map((b) => ({
          id: b.id,
          name: b.name,
          meta: b.categoryName,
        }))}
        value={value.brandId}
        onChange={(brandId) => onChange({ ...value, brandId })}
      />
      <LinkRow
        label="Track"
        placeholder="Link a track…"
        items={tracks.map((t) => ({
          id: t.id,
          name: t.name,
        }))}
        value={value.trackId}
        onChange={(trackId) => onChange({ ...value, trackId })}
      />
      <LinkRow
        label="License"
        placeholder="Link a license…"
        items={licenses.map((l) => ({
          id: l.id,
          name: `${l.trackName} × ${l.brandName}`,
          meta: formatMoney(l.fee),
        }))}
        value={value.licenseId}
        onChange={(licenseId) => onChange({ ...value, licenseId })}
      />
    </div>
  )
}
