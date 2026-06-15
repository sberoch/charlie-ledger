"use client"

import { cn } from "@workspace/ui/lib/utils"

/** Multi-select twin of SegControl — same square chips, but several can be on
 *  at once (toggle membership). Used for a License's Usage Types, which is a set
 *  (one or more media) rather than a single pick. See ADR-0004. */
export function MultiSegControl<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: Array<{ value: T; label: string }>
  value: T[]
  onChange: (value: T[]) => void
  disabled?: boolean
}) {
  const toggle = (option: T) =>
    onChange(
      value.includes(option)
        ? value.filter((v) => v !== option)
        : [...value, option]
    )

  return (
    <div className="flex flex-wrap gap-1.5" role="group">
      {options.map((option) => {
        const on = value.includes(option.value)
        return (
          <button
            key={option.value}
            type="button"
            role="checkbox"
            aria-checked={on}
            disabled={disabled}
            onClick={() => toggle(option.value)}
            className={cn(
              "min-h-10 cursor-pointer border bg-background px-3 py-2 text-xs tracking-[0.06em] text-ink-soft uppercase transition-colors",
              "hover:border-ink-soft hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50",
              on &&
                "border-foreground bg-primary text-primary-foreground hover:text-primary-foreground"
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
