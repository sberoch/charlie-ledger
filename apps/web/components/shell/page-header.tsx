import { cn } from "@workspace/ui/lib/utils"

/** The prototype's page header — display title, uppercase mono subtitle,
 *  meta/actions on the right (stacking under the title on mobile). */
export function PageHeader({
  title,
  subtitle,
  children,
  className,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        "mb-6 flex flex-col gap-4 border-b pb-5 md:mb-8 md:flex-row md:items-end md:justify-between",
        className
      )}
    >
      <div>
        <h1 className="font-heading text-[26px] leading-none tracking-tight md:text-[32px]">
          {title}
        </h1>
        {subtitle ? (
          <div className="mt-2.5 text-xs tracking-[0.1em] text-muted-foreground uppercase">
            {subtitle}
          </div>
        ) : null}
      </div>
      {children ? (
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          {children}
        </div>
      ) : null}
    </header>
  )
}
