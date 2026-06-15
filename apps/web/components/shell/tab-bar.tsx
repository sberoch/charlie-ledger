"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"
import { cn } from "@workspace/ui/lib/utils"
import { signOut } from "@/lib/auth-client"
import { MORE_ICON, MORE_NAV, PRIMARY_NAV } from "./nav-config"

/** Mobile bottom navigation — thumb-reach for the four daily surfaces;
 *  Invoices/Reports/Settings live in the More sheet. Hidden from md up. */
export function TabBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [moreOpen, setMoreOpen] = useState(false)
  const MoreIcon = MORE_ICON
  const moreActive = MORE_NAV.some((item) => pathname.startsWith(item.href))

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Primary"
    >
      {PRIMARY_NAV.map((item) => {
        const active = pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-1 border-t-2 border-transparent py-2 text-[10px] tracking-[0.08em] text-muted-foreground uppercase",
              active && "border-foreground font-semibold text-foreground"
            )}
          >
            <item.icon className="size-5" strokeWidth={active ? 2.2 : 1.6} />
            {item.label}
          </Link>
        )
      })}

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex flex-col items-center gap-1 border-t-2 border-transparent py-2 text-[10px] tracking-[0.08em] text-muted-foreground uppercase",
              moreActive && "border-foreground font-semibold text-foreground"
            )}
          >
            <MoreIcon className="size-5" strokeWidth={moreActive ? 2.2 : 1.6} />
            More
          </button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="pb-[max(env(safe-area-inset-bottom),16px)]"
        >
          <SheetHeader>
            <SheetTitle className="text-left text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              More
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-col px-2">
            {MORE_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 border-b border-border-soft px-2 py-3.5 text-sm last:border-0"
              >
                <item.icon
                  className="size-4.5 text-ink-soft"
                  strokeWidth={1.8}
                />
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() =>
                signOut().then(() => {
                  setMoreOpen(false)
                  router.push("/sign-in")
                })
              }
              className="flex items-center gap-3 px-2 py-3.5 text-left text-sm text-muted-foreground"
            >
              Sign out
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  )
}
