"use client"

import { useMemo, useState } from "react"
import { Pencil } from "lucide-react"
import { toast } from "sonner"
import type { BrandDto } from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Panel } from "@/components/panel"
import { EntityCombobox } from "@/features/parties/entity-combobox"
import {
  useBrands,
  useCategories,
  useCreateCategory,
  useUpdateBrand,
} from "@/features/parties/hooks"

const UNCATEGORIZED = "uncategorized"

export function isUncategorized(brand: BrandDto): boolean {
  return brand.categoryName.toLowerCase() === UNCATEGORIZED
}

function BrandRow({ brand }: { brand: BrandDto }) {
  const { data: categories = [] } = useCategories()
  const createCategory = useCreateCategory()
  const update = useUpdateBrand()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(brand.name)
  const [categoryId, setCategoryId] = useState(brand.categoryId)

  const save = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    update.mutate(
      { id: brand.id, name: trimmed, categoryId },
      {
        onSuccess: () => {
          setEditing(false)
          toast.success("Brand saved")
        },
        onError: (e) => toast.error(e.message),
      }
    )
  }

  if (editing) {
    return (
      <div className="border-b border-border-soft py-2.5 last:border-0">
        <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditing(false)
            }}
            className="h-10 md:max-w-56"
          />
          <div className="min-w-0 flex-1">
            <EntityCombobox
              items={categories.map((c) => ({ id: c.id, name: c.name }))}
              value={categoryId}
              onSelect={(item) => setCategoryId(item.id)}
              onCreate={(newName) =>
                void createCategory
                  .mutateAsync(newName)
                  .then((category) => setCategoryId(category.id))
                  .catch((e: Error) => toast.error(e.message))
              }
              placeholder="Category…"
              emptyHint="Type a new category name to create it."
            />
          </div>
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
                setName(brand.name)
                setCategoryId(brand.categoryId)
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex items-center justify-between gap-2 border-b border-border-soft py-2.5 text-sm last:border-0">
      <span className="truncate font-medium">{brand.name}</span>
      <span className="flex shrink-0 items-center gap-1">
        <span
          className={
            isUncategorized(brand)
              ? "mr-1 text-xs text-ochre"
              : "mr-1 text-xs text-muted-foreground"
          }
        >
          {brand.categoryName}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Edit ${brand.name}`}
          onClick={() => {
            setName(brand.name)
            setCategoryId(brand.categoryId)
            setEditing(true)
          }}
        >
          <Pencil />
        </Button>
      </span>
    </div>
  )
}

export function BrandsPanel() {
  const { data: brands } = useBrands()
  const [search, setSearch] = useState("")

  // Uncategorized first (they're the work queue), then alphabetical.
  const sorted = useMemo(() => {
    const list = [...(brands ?? [])]
    return list.sort((a, b) => {
      const ua = isUncategorized(a)
      const ub = isUncategorized(b)
      if (ua !== ub) return ua ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }, [brands])

  const filtered = sorted.filter((b) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      b.name.toLowerCase().includes(q) ||
      b.categoryName.toLowerCase().includes(q)
    )
  })

  const uncategorized = (brands ?? []).filter(isUncategorized).length

  return (
    <Panel title={`Brands · ${brands?.length ?? "…"}`}>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        Every brand needs a category — it drives the per-category rollups and
        the exclusivity collision warning.
        {uncategorized > 0 ? (
          <>
            {" "}
            <span className="text-ochre">
              {uncategorized} still uncategorized
            </span>{" "}
            — they sort first.
          </>
        ) : null}
      </p>

      <Input
        placeholder="Search brand or category…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-2 h-9"
      />

      {brands ? (
        <div className="flex max-h-[32rem] flex-col overflow-y-auto">
          {filtered.map((brand) => (
            <BrandRow key={brand.id} brand={brand} />
          ))}
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No brand matches &ldquo;{search}&rdquo;.
            </p>
          ) : null}
        </div>
      ) : (
        <Skeleton className="h-64" />
      )}
    </Panel>
  )
}
