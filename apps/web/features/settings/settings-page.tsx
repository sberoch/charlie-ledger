"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "@workspace/ui/lib/utils"
import { PageHeader } from "@/components/shell/page-header"
import { useBrands } from "@/features/parties/hooks"
import { BrandsPanel, isUncategorized } from "./brands-panel"
import { GeneralPanel } from "./general-panel"
import { PayersPanel } from "./payers-panel"
import { TagsPanel } from "./tags-panel"
import { UsersPanel } from "./users-panel"

const SECTIONS = [
  { id: "general", label: "General" },
  { id: "users", label: "Users" },
  { id: "brands", label: "Brands" },
  { id: "payers", label: "Payers" },
  { id: "tags", label: "Tags" },
] as const

type SectionId = (typeof SECTIONS)[number]["id"]

export function SettingsPage() {
  const router = useRouter()
  const params = useSearchParams()
  const raw = params.get("section")
  const section: SectionId = SECTIONS.some((s) => s.id === raw)
    ? (raw as SectionId)
    : "general"

  const { data: brands } = useBrands()
  const uncategorized = (brands ?? []).filter(isUncategorized).length

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Settings" />

      <div className="flex flex-col gap-5 md:grid md:grid-cols-[11rem_1fr] md:items-start">
        <nav
          aria-label="Settings sections"
          className="flex overflow-x-auto border bg-card md:sticky md:top-6 md:flex-col"
        >
          {SECTIONS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-current={section === id ? "page" : undefined}
              onClick={() =>
                router.replace(`/settings?section=${id}`, { scroll: false })
              }
              className={cn(
                "flex shrink-0 cursor-pointer items-center justify-between gap-3 border-l-2 px-3.5 py-2.5 text-left text-sm transition-colors",
                "md:border-b md:border-b-border-soft md:last:border-b-0",
                section === id
                  ? "border-l-foreground bg-secondary/60 font-medium text-foreground"
                  : "border-l-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
              {id === "brands" && uncategorized > 0 ? (
                <span className="text-[11px] text-ochre tabular-nums">
                  {uncategorized}
                </span>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="min-w-0">
          {section === "general" ? <GeneralPanel /> : null}
          {section === "users" ? <UsersPanel /> : null}
          {section === "brands" ? <BrandsPanel /> : null}
          {section === "payers" ? <PayersPanel /> : null}
          {section === "tags" ? <TagsPanel /> : null}
        </div>
      </div>
    </div>
  )
}
