import clsx from 'clsx'
import type React from 'react'

/**
 * A titled card surface for the admin (dark-mode aware). Wraps content in a
 * rounded bordered panel; renders an optional header row with title,
 * description and right-aligned actions. Server-safe.
 */
export interface AdminSectionProps {
  title?: string
  description?: string
  /** Right-aligned actions in the header row. */
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  /** Drop the inner padding (useful when the child is a full-bleed table). */
  flush?: boolean
}

export function AdminSection({ title, description, actions, children, className, flush = false }: AdminSectionProps) {
  const hasHeader = Boolean(title || description || actions)
  return (
    <section
      className={clsx(
        className,
        'rounded-xl border border-zinc-950/10 bg-white dark:border-white/10 dark:bg-zinc-900',
      )}
    >
      {hasHeader ? (
        <div className="flex flex-col gap-2 border-b border-zinc-950/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-white/10">
          <div className="min-w-0">
            {title ? <h2 className="text-sm/6 font-semibold text-zinc-950 dark:text-white">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-xs/5 text-zinc-500 dark:text-zinc-400">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={clsx(!flush && 'p-5 sm:p-6')}>{children}</div>
    </section>
  )
}
