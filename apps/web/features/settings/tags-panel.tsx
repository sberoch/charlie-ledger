"use client"

import { useState } from "react"
import { Check, Pencil, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import type { TagDto } from "@workspace/shared"
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
  useCreateTag,
  useDeleteTag,
  useRenameTag,
  useTags,
} from "./tags-hooks"

function usageLabel(count: number): string {
  if (count === 0) return "Unused"
  return `${count} track${count === 1 ? "" : "s"}`
}

function TagRow({ tag }: { tag: TagDto }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(tag.name)
  const rename = useRenameTag()
  const del = useDeleteTag()

  const save = () => {
    const name = value.trim()
    if (!name || name === tag.name) {
      setEditing(false)
      setValue(tag.name)
      return
    }
    rename.mutate(
      { id: tag.id, name },
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
              setValue(tag.name)
            }
          }}
          className="h-8 flex-1"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Save tag"
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
            setValue(tag.name)
          }}
        >
          <X />
        </Button>
      </div>
    )
  }

  return (
    <div className="group flex items-center justify-between gap-2 border-b border-border-soft py-2.5 text-sm last:border-0">
      <span className="font-medium">{tag.name}</span>
      <span className="flex items-center gap-1">
        <span className="mr-1 text-xs text-muted-foreground tabular-nums">
          {usageLabel(tag.usageCount)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Rename ${tag.name}`}
          onClick={() => {
            setValue(tag.name)
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
              aria-label={`Delete ${tag.name}`}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete &ldquo;{tag.name}&rdquo;?</AlertDialogTitle>
              <AlertDialogDescription>
                {tag.usageCount === 0
                  ? "Not used by any track. This can't be undone."
                  : `Used by ${usageLabel(tag.usageCount)} — deleting removes it from them. This can't be undone.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() =>
                  del.mutate(tag.id, {
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

export function TagsPanel() {
  const { data: tags } = useTags()
  const create = useCreateTag()
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
    <Panel title={`Tags · ${tags?.length ?? "…"}`}>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        The catalog tag vocabulary. Renaming or deleting a tag updates every
        track that carries it.
      </p>

      {tags ? (
        <div className="mb-4 flex max-h-80 flex-col overflow-y-auto">
          {tags.map((tag) => (
            <TagRow key={tag.id} tag={tag} />
          ))}
        </div>
      ) : (
        <Skeleton className="mb-4 h-40" />
      )}

      <div className="border-t pt-4">
        <div className="mb-2.5 text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
          Add tag
        </div>
        <div className="flex gap-2.5">
          <Input
            placeholder="Tag name"
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
