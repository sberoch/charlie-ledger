"use client"

import { cn } from "@workspace/ui/lib/utils"

/** The prototype's segmented enum picker — square chips, ink inversion when
 *  on. Wraps on narrow screens; every target is ≥40px tall for thumbs. */
export function SegControl<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: Array<{ value: T; label: string }>
  value: T | undefined
  onChange: (value: T) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={cn(
            "min-h-10 cursor-pointer border bg-background px-3 py-2 text-xs tracking-[0.06em] text-ink-soft uppercase transition-colors",
            "hover:border-ink-soft hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50",
            value === option.value &&
              "border-foreground bg-primary text-primary-foreground hover:text-primary-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
