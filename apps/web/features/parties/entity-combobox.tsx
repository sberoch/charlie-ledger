"use client"

import { useState } from "react"
import { Check, ChevronsUpDown, Plus } from "lucide-react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@workspace/ui/components/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"

export interface ComboboxItem {
  id: string
  name: string
  /** Dim suffix line, e.g. the brand's category. */
  meta?: string
}

/**
 * The pick-or-create combobox behind Brand / Payer / Track fields. Client-side
 * filtering (the lookups are small); typing an unknown name surfaces a
 * "Create" row that hands the raw query to the caller.
 */
export function EntityCombobox({
  items,
  value,
  onSelect,
  onCreate,
  placeholder,
  emptyHint,
  disabled,
}: {
  items: ComboboxItem[]
  value: string | null
  onSelect: (item: ComboboxItem) => void
  /** Omit to disable creation (e.g. Track — a read-only Disco mirror). */
  onCreate?: (name: string) => void
  placeholder: string
  emptyHint?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const selected = items.find((item) => item.id === value)
  const trimmed = query.trim()
  const exactMatch = items.some(
    (item) => item.name.toLowerCase() === trimmed.toLowerCase()
  )

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery("")
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-10 w-full cursor-pointer items-center justify-between gap-2 border border-input bg-background px-3 text-left text-sm transition-colors",
            "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/15 focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !selected && "text-muted-foreground"
          )}
        >
          <span className="truncate">
            {selected ? selected.name : placeholder}
            {selected?.meta ? (
              <span className="text-muted-foreground"> · {selected.meta}</span>
            ) : null}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command>
          <CommandInput
            placeholder="Search…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty className="px-3 py-4 text-xs text-muted-foreground">
              {emptyHint ?? "Nothing found."}
            </CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.name} ${item.meta ?? ""}`}
                  onSelect={() => {
                    onSelect(item)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "size-4",
                      item.id === value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  {item.meta ? (
                    <span className="w-2/5 shrink-0 truncate text-xs text-muted-foreground">
                      {item.meta}
                    </span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
            {onCreate && trimmed.length > 0 && !exactMatch ? (
              <CommandGroup forceMount>
                <CommandItem
                  forceMount
                  value={`__create__${trimmed}`}
                  onSelect={() => {
                    onCreate(trimmed)
                    setOpen(false)
                  }}
                >
                  <Plus className="size-4" />
                  Create “{trimmed}”
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
