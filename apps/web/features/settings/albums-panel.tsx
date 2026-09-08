"use client"

import { useState } from "react"
import { Check, Pencil, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { formatMoney, type AlbumDto } from "@workspace/shared"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Panel } from "@/components/panel"
import {
  useAlbums,
  useCreateAlbum,
  useDeleteAlbum,
  useRenameAlbum,
} from "./albums-hooks"

function trackLabel(count: number): string {
  if (count === 0) return "Empty"
  return `${count} track${count === 1 ? "" : "s"}`
}

function AlbumRow({ album }: { album: AlbumDto }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(album.name)
  const rename = useRenameAlbum()
  const del = useDeleteAlbum()

  const save = () => {
    const name = value.trim()
    if (!name || name === album.name) {
      setEditing(false)
      setValue(album.name)
      return
    }
    rename.mutate(
      { id: album.id, name },
      {
        onSuccess: () => setEditing(false),
        onError: (e) => toast.error(e.message),
      }
    )
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 border-b border-border-soft py-2 last:border-0">
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save()
            if (e.key === "Escape") {
              setEditing(false)
              setValue(album.name)
            }
          }}
          className="h-8 flex-1"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Save album"
          disabled={rename.isPending}
          onClick={save}
        >
          <Check />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Cancel"
          onClick={() => {
            setEditing(false)
            setValue(album.name)
          }}
        >
          <X />
        </Button>
      </div>
    )
  }

  const income = Number(album.lifetimeSales) + Number(album.lifetimeRoyalties)

  return (
    <div className="group flex items-center justify-between gap-2 border-b border-border-soft py-2.5 text-sm last:border-0">
      <span className="min-w-0">
        <span className="block truncate font-medium">{album.name}</span>
        <span className="block text-xs text-muted-foreground tabular-nums">
          {trackLabel(album.trackCount)} · {formatMoney(income.toFixed(2))}{" "}
          lifetime
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Rename ${album.name}`}
          onClick={() => {
            setValue(album.name)
            setEditing(true)
          }}
        >
          <Pencil />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${album.name}`}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete &ldquo;{album.name}&rdquo;?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {album.trackCount === 0
                  ? "No tracks belong to it. This can't be undone."
                  : `${trackLabel(album.trackCount)} will be set to "No album". Their licenses and history are untouched. This can't be undone.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() =>
                  del.mutate(album.id, {
                    onError: (e) => toast.error(e.message),
                  })
                }
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </span>
    </div>
  )
}

export function AlbumsPanel() {
  const { data: albums } = useAlbums()
  const create = useCreateAlbum()
  const [newName, setNewName] = useState("")

  const add = () => {
    const name = newName.trim()
    if (!name) return
    create.mutate(
      { name },
      {
        onSuccess: () => setNewName(""),
        onError: (e) => toast.error(e.message),
      }
    )
  }

  return (
    <Panel title={`Albums · ${albums?.length ?? "…"}`}>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        The library releases tracks were ingested under. Each track belongs to
        one album or none. Renaming updates every track; deleting an album sets
        its tracks to &ldquo;No album&rdquo;.
      </p>

      {albums ? (
        <div className="mb-4 flex max-h-96 flex-col overflow-y-auto">
          {albums.map((album) => (
            <AlbumRow key={album.id} album={album} />
          ))}
          {albums.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No albums yet.
            </p>
          ) : null}
        </div>
      ) : (
        <Skeleton className="mb-4 h-40" />
      )}

      <div className="border-t pt-4">
        <div className="mb-2.5 text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
          Add album
        </div>
        <div className="flex gap-2.5">
          <Input
            placeholder="Album name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add()
            }}
          />
          <Button
            type="button"
            disabled={create.isPending || !newName.trim()}
            onClick={add}
          >
            Add
          </Button>
        </div>
      </div>
    </Panel>
  )
}
