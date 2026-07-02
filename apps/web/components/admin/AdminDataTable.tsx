import clsx from 'clsx'
import type React from 'react'
import { adminAccentTop, adminPanel } from './admin-surface'

/**
 * Surface wrapper for a Catalyst <Table>. Wraps the table in a bordered,
 * rounded, dark-mode-aware panel that scrolls horizontally on its own.
 */
export interface AdminDataTableProps {
  children: React.ReactNode
  className?: string
}

export function AdminDataTable({ children, className }: AdminDataTableProps) {
  return (
    <div
      className={clsx(
        className,
        'relative border-t border-zinc-800 bg-zinc-950',
      )}
    >
      <div className="[--gutter:--spacing(6)]">{children}</div>
    </div>
  )
}
