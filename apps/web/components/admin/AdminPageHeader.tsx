import clsx from 'clsx'
import type React from 'react'
import { Heading } from '@/components/catalyst/heading'

/**
 * Standard admin page header: title row (Catalyst Heading) with right-aligned
 * actions, an optional subtitle line, and an optional meta strip underneath.
 * Server-safe (no client hooks).
 */
export interface AdminPageHeaderProps {
  title: string
  subtitle?: string
  /** Small meta strip rendered under the title (counts, updated-at, etc.). */
  meta?: React.ReactNode
  /** Right-aligned action buttons. */
  actions?: React.ReactNode
  className?: string
}

export function AdminPageHeader({ title, subtitle, meta, actions, className }: AdminPageHeaderProps) {
  return (
    <div className={clsx(className, 'flex flex-col gap-4 pb-6 sm:flex-row sm:items-start sm:justify-between')}>
      <div className="min-w-0">
        <Heading>{title}</Heading>
        {subtitle ? <p className="mt-1 text-sm/6 text-zinc-500 dark:text-zinc-400">{subtitle}</p> : null}
        {meta ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs/5 text-zinc-500 dark:text-zinc-400">
            {meta}
          </div>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div> : null}
    </div>
  )
}
