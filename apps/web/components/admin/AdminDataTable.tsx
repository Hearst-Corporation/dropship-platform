import clsx from 'clsx'
import type React from 'react'

/**
 * Surface wrapper for a Catalyst <Table>. Wraps the table in a bordered,
 * rounded, dark-mode-aware panel that scrolls horizontally on its own
 * (`overflow-x-auto`) so wide tables never get clipped under the right chat
 * rail. Pass `minWidth` (a Tailwind min-w-* class) to force horizontal scroll
 * instead of column crush on narrow viewports.
 *
 * Children should be a Catalyst <Table> (which already renders thead/tbody).
 * Catalyst's own Table also has an overflow wrapper, but its negative
 * `-mx-(--gutter)` margin is neutralised here by not setting a `--gutter`,
 * so the border stays flush.
 *
 * Server-safe (pure presentational).
 */
export interface AdminDataTableProps {
  children: React.ReactNode
  /** A Tailwind `min-w-*` class, e.g. "min-w-3xl" or "min-w-[52rem]". */
  minWidth?: string
  className?: string
}

export function AdminDataTable({ children, minWidth, className }: AdminDataTableProps) {
  return (
    <div
      className={clsx(
        className,
        'overflow-x-auto rounded-xl border border-zinc-950/10 bg-white dark:border-white/10 dark:bg-zinc-900',
      )}
    >
      <div className={clsx('[--gutter:--spacing(6)]', minWidth)}>{children}</div>
    </div>
  )
}
