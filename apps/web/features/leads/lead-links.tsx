"use client"

import { X } from "lucide-react"
import { formatMoney } from "@workspace/shared"
import { useDemos } from "@/features/demos/hooks"
import { useLicenses } from "@/features/licenses/hooks"
import { useBrands } from "@/features/parties/hooks"
import { useTracks } from "@/features/tracks/hooks"
import { EntityCombobox } from "@/features/parties/entity-combobox"

export interface LeadLinkValue {
  brandId: string | null
  licenseId: string | null
  demoId: string | null
  trackId: string | null
}

/** A labelled combobox + a clear button, shown once a value is picked. Links
 *  are pick-only — no inline create (Leads attach to things that already
 *  exist). All three are independent; any combination is allowed (Q2). */
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

export function LeadLinks({
  value,
  onChange,
}: {
  value: LeadLinkValue
  onChange: (next: LeadLinkValue) => void
}) {
  const { data: brands = [] } = useBrands()
  const { data: licenses = [] } = useLicenses()
  const { data: demos = [] } = useDemos()
  const { data: tracks = [] } = useTracks()

  return (
    <div className="mt-3 grid gap-3 border-t border-dashed pt-3 md:grid-cols-2">
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
      <LinkRow
        label="Demo"
        placeholder="Link a demo…"
        items={demos.map((d) => ({
          id: d.id,
          name: d.workingName,
          meta: d.brandName,
        }))}
        value={value.demoId}
        onChange={(demoId) => onChange({ ...value, demoId })}
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
    </div>
  )
}
