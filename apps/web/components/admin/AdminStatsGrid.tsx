import clsx from 'clsx'
import type React from 'react'

/**
 * Responsive grid for AdminStatCard rows. Default breaks 1 -> 2 -> 4 columns.
 * Pass `cols={6}` for a wider KPI strip. Server-safe.
 *
 * Breakpoints land one step later than a naive grid: the fixed right agent
 * rail (24rem) eats into the xl viewport, so max density only kicks in at 2xl
 * where the content area is actually wide enough.
 */
export interface AdminStatsGridProps {
  children: React.ReactNode
  /** Max columns at the 2xl breakpoint. Supported: 2, 3, 4, 6. Default 4. */
  cols?: 2 | 3 | 4 | 6
  className?: string
}

const colsClass: Record<NonNullable<AdminStatsGridProps['cols']>, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 2xl:grid-cols-3',
  4: 'sm:grid-cols-2 2xl:grid-cols-4',
  6: 'sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6',
}

export function AdminStatsGrid({ children, cols = 4, className }: AdminStatsGridProps) {
  return <div className={clsx(className, 'grid grid-cols-1 gap-4', colsClass[cols])}>{children}</div>
}
