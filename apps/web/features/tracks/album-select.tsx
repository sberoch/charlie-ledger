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
import { cn } from "@workspace/ui/lib/utils"
import { useAlbums } from "@/features/settings/albums-hooks"

/**
 * Single-select album picker for the track form. Works with album NAMES —
 * picking an existing album or typing a new one both set a name; the server
 * resolves it via case-insensitive pick-or-create on save. Null = "No album".
 * See CONTEXT.md ("Album").
 */
export function AlbumSelect({
  value,
  onChange,
}: {
  value: string | null
  onChange: (value: string | null) => void
}) {
  const { data: albums = [] } = useAlbums()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const trimmed = query.trim()
  const exactMatch = albums.some(
    (a) => a.name.toLowerCase() === trimmed.toLowerCase()
  )
  const pick = (name: string | null) => {
    onChange(name)
    setQuery("")
    setOpen(false)
  }

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
          className={cn(
            "flex h-10 w-full cursor-pointer items-center justify-between gap-2 border border-input bg-background px-3 text-left text-sm transition-colors",
            "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/15 focus-visible:outline-none",
            !value && "text-muted-foreground"
          )}
        >
          <span className="truncate">{value ?? "No album"}</span>
          <span className="flex shrink-0 items-center gap-1">
            {value ? (
              <span
                role="button"
                aria-label="Clear album"
                onClick={(e) => {
                  e.stopPropagation()
                  pick(null)
                }}
                className="rounded-xs opacity-60 hover:opacity-100"
              >
                <X className="size-4" />
              </span>
            ) : null}
            <ChevronsUpDown className="size-4 opacity-50" />
          </span>
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
              Type to create a new album.
            </CommandEmpty>
            <CommandGroup>
              <CommandItem value="__none__" onSelect={() => pick(null)}>
                <Check
                  className={cn("size-4", value ? "opacity-0" : "opacity-100")}
                />
                <span className="text-muted-foreground">No album</span>
              </CommandItem>
              {albums.map((album) => (
                <CommandItem
                  key={album.id}
                  value={album.name}
                  onSelect={() => pick(album.name)}
                >
                  <Check
                    className={cn(
                      "size-4",
                      value?.toLowerCase() === album.name.toLowerCase()
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{album.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {album.trackCount} track{album.trackCount === 1 ? "" : "s"}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            {trimmed.length > 0 && !exactMatch ? (
              <CommandGroup forceMount>
                <CommandItem
                  forceMount
                  value={`__create__${trimmed}`}
                  onSelect={() => pick(trimmed)}
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
