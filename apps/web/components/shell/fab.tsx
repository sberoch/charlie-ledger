"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Coins, Disc3, FileBadge, Music, Plus } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"

/** Mobile creation affordance — the app's core action, always in thumb reach.
 *  Opens the New License / New Demo chooser. Hidden from md up (the sidebar
 *  and per-screen buttons take over) and on the create forms themselves. */
export function Fab() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  if (pathname.endsWith("/new")) return null

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Create"
          className="fixed right-4 bottom-[calc(64px+env(safe-area-inset-bottom))] z-40 flex size-13 items-center justify-center border border-foreground bg-primary text-primary-foreground shadow-[4px_4px_0_0_rgba(26,26,26,0.18)] active:translate-y-px md:hidden"
        >
          <Plus className="size-6" strokeWidth={2} />
        </button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="pb-[max(env(safe-area-inset-bottom),16px)]"
      >
        <SheetHeader>
          <SheetTitle className="text-left text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Create
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-col px-2">
          <Link
            href="/licenses/new"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 border-b border-border-soft px-2 py-4 text-sm font-semibold"
          >
            <FileBadge className="size-5 text-ink-soft" strokeWidth={1.8} />
            New License
          </Link>
          <Link
            href="/demos/new"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 border-b border-border-soft px-2 py-4 text-sm font-semibold"
          >
            <Disc3 className="size-5 text-ink-soft" strokeWidth={1.8} />
            New Demo
          </Link>
          <Link
            href="/tracks/new"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 border-b border-border-soft px-2 py-4 text-sm font-semibold"
          >
            <Music className="size-5 text-ink-soft" strokeWidth={1.8} />
            New Track
          </Link>
          {/* No /new page — royalties use the pinned composer; #add focuses it. */}
          <Link
            href="/royalties#add"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-2 py-4 text-sm font-semibold"
          >
            <Coins className="size-5 text-ink-soft" strokeWidth={1.8} />
            New Royalty Payment
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  )
}
