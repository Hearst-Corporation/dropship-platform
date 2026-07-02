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
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center bg-zinc-950">
      {Icon ? (
        <div className="mb-6 flex size-12 items-center justify-center bg-zinc-900">
          <Icon className="size-6 text-zinc-500" />
        </div>
      ) : null}
      <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-white">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-sm text-sm font-medium text-zinc-500">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}
