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
 * `--gutter` is set for comfortable first/last cell padding AND compensated
 * with `px-(--gutter)`: Catalyst's inner wrapper applies `-mx-(--gutter)`,
 * so without the matching padding every panel would overflow by 2×gutter and
 * grow a phantom horizontal scrollbar.
 *
 * Pass `bare` when the table sits inside an already-bordered surface (e.g. an
 * AdminSection with `flush`) to avoid double borders and nested rounded panels.
 *
 * Server-safe (pure presentational).
 */
export interface AdminDataTableProps {
  children: React.ReactNode
  /** A Tailwind `min-w-*` class, e.g. "min-w-3xl" or "min-w-[52rem]". */
  minWidth?: string
  /** Drop the panel chrome (border/radius/bg) when nested in a flush AdminSection. */
  bare?: boolean
  className?: string
}

export function AdminDataTable({ children, minWidth, bare = false, className }: AdminDataTableProps) {
  return (
    <div
      className={clsx(
        className,
        'overflow-x-auto',
        !bare && 'rounded-xl border border-zinc-950/10 bg-white dark:border-white/10 dark:bg-zinc-900',
      )}
    >
      <div className={clsx('px-(--gutter) [--gutter:--spacing(6)]', minWidth)}>{children}</div>
    </div>
  )
}
