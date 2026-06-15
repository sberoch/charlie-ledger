"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { downloadFile } from "@/lib/api"

// Radix Select can't carry an empty value, so "All Tags" rides a sentinel.
const ALL = "__all__"

export function TrackExportDialog({
  tags,
  currentTag,
  search,
}: {
  tags: string[]
  currentTag: string | null
  search: string
}) {
  const [open, setOpen] = useState(false)
  const [tag, setTag] = useState(currentTag ?? ALL)
  const [financials, setFinancials] = useState(false)

  // Re-seed from the page's active tag each time the dialog opens, so the
  // export defaults to exactly the view Charlie is looking at.
  const onOpenChange = (next: boolean) => {
    if (next) setTag(currentTag ?? ALL)
    setOpen(next)
  }

  const exportAs = (ext: "csv" | "pdf") => {
    const params = new URLSearchParams()
    if (tag !== ALL) params.set("tag", tag)
    if (search) params.set("search", search)
    if (financials) params.set("financials", "true")
    const qs = params.toString()
    const slug = tag === ALL ? "all" : tag.toLowerCase().replace(/[^a-z0-9]+/g, "-")

    downloadFile(
      `/tracks/export.${ext}${qs ? `?${qs}` : ""}`,
      `tracks_${slug}.${ext}`
    )
      .then(() => setOpen(false))
      .catch((e) => toast.error(e.message))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Export tracks</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-1">
          <div>
            <label className="mb-2 block text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
              Tag
            </label>
            <Select value={tag} onValueChange={setTag}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Tags</SelectItem>
                {tags.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex cursor-pointer items-center gap-2.5">
            <Checkbox
              checked={financials}
              onCheckedChange={(c) => setFinancials(c === true)}
            />
            <span className="text-sm">
              Include financials
              <span className="block text-xs text-muted-foreground">
                Licenses, lifetime sales, and last licensed date.
              </span>
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => exportAs("csv")}
          >
            Export CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => exportAs("pdf")}
          >
            Export PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
