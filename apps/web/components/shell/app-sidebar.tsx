"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@workspace/ui/lib/utils"
import { signOut, useSession } from "@/lib/auth-client"
import { MORE_NAV, PRIMARY_NAV, type NavItem } from "./nav-config"

function SidebarItem({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        "-ml-0.5 flex items-center gap-3 border-l-2 border-transparent px-3 py-2.5 text-[13.5px] text-ink-soft transition-colors select-none",
        "hover:bg-black/[0.03] hover:text-foreground",
        active &&
          "border-foreground bg-black/[0.04] font-semibold text-foreground"
      )}
    >
      <span className="inline-block w-3.5 text-center text-xs opacity-70">
        {item.glyph}
      </span>
      {item.label}
    </Link>
  )
}

/** Desktop navigation — the prototype's 240px recessed rail, verbatim. */
export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()

  return (
    <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col overflow-y-auto border-r bg-sidebar py-7 md:flex">
      <div className="mb-6 border-b px-6 pb-7">
        <Link
          href="/dashboard"
          className="font-heading text-xl leading-none tracking-tight"
        >
          CHARLIE FOLTZ
        </Link>
        <div className="mt-2 text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
          License manager
        </div>
      </div>

      <nav className="mb-7 px-3">
        <div className="px-3 pb-2.5 text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
          Workspace
        </div>
        {[...PRIMARY_NAV, ...MORE_NAV].map((item) => (
          <SidebarItem
            key={item.href}
            item={item}
            active={pathname.startsWith(item.href)}
          />
        ))}
        <Link
          href="/licenses/new"
          className="-ml-0.5 flex items-center gap-3 border-l-2 border-transparent px-3 py-2.5 text-[13.5px] text-ink-soft transition-colors select-none hover:bg-black/[0.03] hover:text-foreground"
        >
          <span className="inline-block w-3.5 text-center text-xs opacity-70">
            +
          </span>
          New License
        </Link>
      </nav>

      <div className="mt-auto border-t px-6 pt-4 text-[11px] tracking-[0.08em] text-muted-foreground">
        Logged in as
        <br />
        <span className="font-semibold text-foreground">
          {session?.user.email ?? "…"}
        </span>
        <button
          type="button"
          onClick={() => signOut().then(() => router.push("/sign-in"))}
          className="mt-2 block cursor-pointer underline decoration-border underline-offset-3 hover:text-foreground"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
