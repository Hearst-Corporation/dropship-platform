import clsx from 'clsx'
import type React from 'react'
import { ArrowTrendingDownIcon, ArrowTrendingUpIcon } from '@heroicons/react/16/solid'

/**
 * Compact KPI card for the admin dashboard. Shows a label, a big value, an
 * optional hint line, an optional colored delta chip, and an optional icon.
 * Dark-mode aware. Server-safe.
 *
 * The `delta.value` string is rendered verbatim — pass real, pre-computed
 * text (e.g. "+12,4 %"). Do NOT fabricate a delta where no source exists;
 * omit `delta` instead.
 */
type Tone = 'default' | 'positive' | 'warning' | 'danger'

export interface AdminStatCardProps {
  label: string
  value: React.ReactNode
  hint?: string
  delta?: { value: string; positive?: boolean }
  icon?: React.ComponentType<{ className?: string }>
  tone?: Tone
}

// Single-accent policy: the only hue allowed is the accent ('indigo').
// `positive` gets a subtle indigo accent; `warning`/`danger` stay neutral
// zinc (disambiguated by their label text, never by color). No forbidden hue.
const toneValue: Record<Tone, string> = {
  default: 'text-zinc-950 dark:text-white',
  positive: 'text-indigo-600 dark:text-indigo-400',
  warning: 'text-zinc-950 dark:text-white',
  danger: 'text-zinc-950 dark:text-white',
}

const toneIcon: Record<Tone, string> = {
  default: 'text-zinc-400 dark:text-zinc-500',
  positive: 'text-indigo-500 dark:text-indigo-400',
  warning: 'text-zinc-400 dark:text-zinc-500',
  danger: 'text-zinc-400 dark:text-zinc-500',
}

export function AdminStatCard({ label, value, hint, delta, icon: Icon, tone = 'default' }: AdminStatCardProps) {
  return (
    <div className="rounded-xl border border-zinc-950/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <p className="truncate text-xs/5 font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
        {Icon ? <Icon className={clsx('size-5 shrink-0', toneIcon[tone])} /> : null}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={clsx('text-2xl font-semibold tracking-tight tabular-nums', toneValue[tone])}>{value}</span>
        {delta ? (
          <span
            className={clsx(
              'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
              delta.positive
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-zinc-500 dark:text-zinc-400',
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
      {hint ? <p className="mt-1 truncate text-xs/5 text-zinc-500 dark:text-zinc-400">{hint}</p> : null}
    </div>
  )
}
