// Skeleton de chargement — reflète la mise en page de analytics/page.tsx
// (header + sélecteur de période, KPIs, funnel, table acquisition, badges).
export default function Loading() {
  return (
    <div className="animate-pulse space-y-8" aria-hidden="true">
      {/* Header + range selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="h-3 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-7 w-72 max-w-full rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-4 w-36 rounded bg-zinc-100 dark:bg-zinc-800/60" />
        </div>
        <div className="flex items-center gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-9 w-20 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div>
        <div className="h-5 w-36 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-6">
              <div className="h-4 w-36 rounded bg-zinc-100 dark:bg-zinc-800/60" />
              <div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
          ))}
        </div>
      </div>

      {/* Funnel */}
      <div className="border-t border-zinc-950/10 pt-8 dark:border-white/10">
        <div className="h-5 w-44 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-6">
              <div className="h-4 w-40 rounded bg-zinc-100 dark:bg-zinc-800/60" />
              <div className="h-4 w-12 rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
          ))}
        </div>
      </div>

      {/* Acquisition table */}
      <div className="border-t border-zinc-950/10 pt-8 dark:border-white/10">
        <div className="h-5 w-40 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-full rounded bg-zinc-100 dark:bg-zinc-800/60" />
          ))}
        </div>
      </div>

      {/* Badges plomberie */}
      <div className="border-t border-zinc-950/10 pt-8 dark:border-white/10">
        <div className="h-5 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-4 flex flex-wrap gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-6 w-28 rounded-md bg-zinc-100 dark:bg-zinc-800/60" />
          ))}
        </div>
      </div>
    </div>
  );
}
