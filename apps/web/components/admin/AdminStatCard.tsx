import clsx from 'clsx'
import type React from 'react'
import { ArrowTrendingDownIcon, ArrowTrendingUpIcon } from '@heroicons/react/16/solid'
import { adminAccentTop, adminPanel } from './admin-surface'

/**
 * Compact KPI card for the admin dashboard. Shows a label, a big value, an
 * optional hint line, an optional colored delta chip, and an optional icon.
 * Dark-mode aware. Server-safe.
 */
type Tone = 'default' | 'positive' | 'warning' | 'danger'

export interface AdminStatCardProps {
  label: string
  value: React.ReactNode
  hint?: string
  delta?: { value: string; positive?: boolean }
  icon?: React.ComponentType<{ className?: string }>
  tone?: Tone
  chart?: React.ReactNode
}

const toneValue: Record<Tone, string> = {
  default: 'text-white dark:text-white',
  positive: 'text-white dark:text-white',
  warning: 'text-white dark:text-white',
  danger: 'text-white dark:text-white',
}

const toneIconWrap: Record<Tone, string> = {
  default: 'text-zinc-500 dark:text-zinc-500',
  positive: 'text-zinc-500 dark:text-zinc-500',
  warning: 'text-zinc-500 dark:text-zinc-500',
  danger: 'text-zinc-500 dark:text-zinc-500',
}

export function AdminStatCard({ label, value, hint, delta, icon: Icon, tone = 'default', chart }: AdminStatCardProps) {
  return (
    <div
      className={clsx(
        'group relative flex flex-col justify-between overflow-hidden p-6 bg-zinc-950 dark:bg-zinc-950',
      )}
    >
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-500">
            {label}
          </p>
          {Icon ? (
            <span className={clsx('flex size-6 shrink-0 items-center justify-end', toneIconWrap[tone])}>
              <Icon className="size-4" />
            </span>
          ) : null}
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className={clsx('text-3xl font-bold tracking-tight tabular-nums', toneValue[tone])}>
            {value}
          </span>
          {delta ? (
            <span
              className={clsx(
                'inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-bold tabular-nums',
                delta.positive ? 'text-indigo-400 dark:text-indigo-400' : 'text-zinc-500 dark:text-zinc-500'
              )}
            >
              {delta.positive ? (
                <ArrowTrendingUpIcon className="size-3.5" />
              ) : (
                <ArrowTrendingDownIcon className="size-3.5" />
              )}
              {delta.value}
            </span>
          ) : null}
        </div>
        {hint ? <p className="mt-2 truncate text-xs font-medium text-zinc-500 dark:text-zinc-500">{hint}</p> : null}
      </div>
      {chart ? (
        <div className="absolute inset-x-0 bottom-0 z-0 h-16 opacity-40">
          {chart}
        </div>
      ) : null}
    </div>
  )
}
