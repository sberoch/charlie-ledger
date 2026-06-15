import { cn } from "@workspace/ui/lib/utils"

/** The prototype's bordered panel with its uppercase hairline title row. */
export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn("flex flex-col border bg-card p-5 md:p-6", className)}
    >
      {title ? (
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            {title}
          </h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  )
}

/** Underlined "View all →" link used in panel corners. */
export function PanelLink(props: React.ComponentProps<"a">) {
  return (
    <a
      {...props}
      className={cn(
        "cursor-pointer text-xs text-ink-soft underline decoration-border underline-offset-3 hover:text-foreground hover:decoration-foreground",
        props.className
      )}
    />
  )
}
