import type React from 'react'

/**
 * Centered empty state for admin lists/tables. Optional icon, title,
 * description and a single call-to-action slot. Dark-mode aware. Server-safe.
 */
export interface AdminEmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: React.ReactNode
}

export function AdminEmptyState({ icon: Icon, title, description, action }: AdminEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {Icon ? (
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-white/5">
          <Icon className="size-6 text-zinc-400 dark:text-zinc-500" />
        </div>
      ) : null}
      <h3 className="text-sm/6 font-semibold text-zinc-950 dark:text-white">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm/6 text-zinc-500 dark:text-zinc-400">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
