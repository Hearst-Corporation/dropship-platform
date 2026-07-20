import clsx from 'clsx'
import { surfaceSunken } from '@/components/ui/surface'

export type BulletMetric = {
  label: string
  value: string
  sublabel?: string
  /** 0–100 progress toward target */
  progress?: number
  /** Optional qualitative band max (same scale as progress) */
  bandMax?: number
}

export function BulletChart({ metrics }: { metrics: BulletMetric[] }) {
  return (
    <ul className="space-y-3">
      {metrics.map((metric) => {
        const progress = Math.min(100, Math.max(0, metric.progress ?? 0))
        const band = Math.min(100, Math.max(progress, metric.bandMax ?? 100))
        return (
          <li key={metric.label} className={clsx(surfaceSunken, 'bg-white/60 p-4 dark:bg-zinc-900/40')}>
            <div className="mb-2 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                  {metric.label}
                </p>
                {metric.sublabel && (
                  <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-500">{metric.sublabel}</p>
                )}
              </div>
              <p className="text-lg font-semibold tabular-nums text-zinc-950 dark:text-white">{metric.value}</p>
            </div>
            <div className="relative h-2.5 overflow-hidden rounded-full bg-zinc-200/80 dark:bg-white/10">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-zinc-300/80 dark:bg-white/15"
                style={{ width: `${band}%` }}
              />
              <div
                className={clsx('absolute inset-y-0 left-0 rounded-full bg-accent-600 dark:bg-accent-500')}
                style={{ width: `${progress}%` }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
