"use client"

import { ChevronDown } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"

/** Single-select filter from the prototype's list screens. `null` value = the
 *  "All" option. `variant="responsive"` (default) shows a native dropdown on
 *  mobile and the prototype's chip row from `md` up; `variant="select"` keeps
 *  the dropdown at every width — used where stacked chip groups would
 *  overcrowd the bar (e.g. the three license filters). */
export function FilterChips<T extends string>({
  label,
  options,
  value,
  onChange,
  allLabel = "All",
  variant = "responsive",
}: {
  label?: string
  options: Array<{ value: T; label: string }>
  value: T | null
  onChange: (value: T | null) => void
  /** Label for the "no filter" choice — e.g. "All Tags". */
  allLabel?: string
  variant?: "responsive" | "select"
}) {
  const isSelect = variant === "select"

  const chip = (active: boolean) =>
    cn(
      "shrink-0 cursor-pointer border bg-background px-3 py-1.5 text-xs tracking-[0.06em] text-ink-soft uppercase transition-colors hover:border-foreground hover:text-foreground",
      active &&
        "border-foreground bg-primary text-primary-foreground hover:text-primary-foreground"
    )

  // The native dropdown — one tap to any option, no scrolling past every chip
  // to reach the one you want. The sole control in `select` mode; the mobile
  // fallback in `responsive` mode.
  const dropdown = (
    <div
      className={cn(
        "flex items-center gap-2",
        isSelect ? "lg:w-56" : "md:hidden"
      )}
    >
      {label ? (
        <span className="shrink-0 text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
          {label}
        </span>
      ) : null}
      <div className="relative min-w-0 flex-1">
        <select
          aria-label={label}
          value={value ?? ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : (e.target.value as T))
          }
          className={cn(
            "h-10 w-full cursor-pointer appearance-none border border-input bg-background pr-9 pl-3 text-sm transition-colors",
            "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/15 focus-visible:outline-none",
            !value && "text-muted-foreground"
          )}
        >
          <option value="">{allLabel}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 opacity-50" />
      </div>
    </div>
  )

  if (isSelect) return dropdown

  return (
    <>
      {dropdown}

      {/* Desktop: the prototype's chip row — wraps instead of scrolling. */}
      <div className="hidden min-w-0 items-center gap-2 md:flex">
        {label ? (
          <span className="shrink-0 text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
            {label}
          </span>
        ) : null}
        <div className="flex min-w-0 flex-wrap gap-1.5">
          <button
            type="button"
            className={chip(value === null)}
            onClick={() => onChange(null)}
          >
            {allLabel}
          </button>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={chip(value === option.value)}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
