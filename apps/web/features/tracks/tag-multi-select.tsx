"use client"

import { useState } from "react"
import { Check, ChevronsUpDown, Plus, X } from "lucide-react"
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
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import { useTags } from "@/features/settings/tags-hooks"

/**
 * Multi-select tag picker for the track form. Works purely with tag NAMES —
 * selecting a vocabulary tag or typing an unknown one both append a name; the
 * server resolves each via case-insensitive pick-or-create on save (an unknown
 * name mints a new Tag). See CONTEXT.md ("Tag") / ADR-0006.
 */
export function TagMultiSelect({
  value,
  onChange,
}: {
  value: string[]
  onChange: (value: string[]) => void
}) {
  const { data: vocabulary = [] } = useTags()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const has = (name: string) =>
    value.some((v) => v.toLowerCase() === name.toLowerCase())
  const add = (name: string) => {
    const trimmed = name.trim()
    if (trimmed && !has(trimmed)) onChange([...value, trimmed])
  }
  const remove = (name: string) =>
    onChange(value.filter((v) => v.toLowerCase() !== name.toLowerCase()))

  const trimmed = query.trim()
  const exactMatch =
    has(trimmed) || vocabulary.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())
  // Suggest only vocabulary tags not already on the track.
  const suggestions = vocabulary.filter((t) => !has(t.name))

  return (
    <div className="flex flex-col gap-2.5">
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((name) => (
            <Badge key={name} variant="tag" className="gap-1 pr-1">
              {name}
              <button
                type="button"
                aria-label={`Remove ${name}`}
                onClick={() => remove(name)}
                className="cursor-pointer rounded-xs opacity-60 hover:opacity-100"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}

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
            className={cn(
              "flex h-10 w-full cursor-pointer items-center justify-between gap-2 border border-input bg-background px-3 text-left text-sm text-muted-foreground transition-colors",
              "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/15 focus-visible:outline-none"
            )}
          >
            <span className="truncate">Add tag…</span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
        >
          <Command>
            <CommandInput
              placeholder="Search or create…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty className="px-3 py-4 text-xs text-muted-foreground">
                Type to create a new tag.
              </CommandEmpty>
              <CommandGroup>
                {suggestions.map((tag) => (
                  <CommandItem
                    key={tag.id}
                    value={tag.name}
                    onSelect={() => {
                      add(tag.name)
                      setQuery("")
                    }}
                  >
                    <Check className="size-4 opacity-0" />
                    <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {tag.usageCount} track{tag.usageCount === 1 ? "" : "s"}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
              {trimmed.length > 0 && !exactMatch ? (
                <CommandGroup forceMount>
                  <CommandItem
                    forceMount
                    value={`__create__${trimmed}`}
                    onSelect={() => {
                      add(trimmed)
                      setQuery("")
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
    </div>
  )
}
