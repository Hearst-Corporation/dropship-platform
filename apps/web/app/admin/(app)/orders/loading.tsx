/** Skeleton miroir de la page orders : heading + action, 4 KPI, table. */
export default function Loading() {
  return (
    <div className="flex min-w-0 flex-1 animate-pulse flex-col space-y-8">
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-72 rounded-lg bg-zinc-950/5 dark:bg-white/10" />
          <div className="h-4 w-96 max-w-full rounded bg-zinc-950/5 dark:bg-white/5" />
        </div>
        <div className="h-9 w-52 rounded-lg bg-zinc-950/5 dark:bg-white/5" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-t border-zinc-950/10 pt-4 dark:border-white/10">
            <div className="h-4 w-24 rounded bg-zinc-950/5 dark:bg-white/5" />
            <div className="mt-2 h-7 w-12 rounded bg-zinc-950/5 dark:bg-white/10" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-950/10 dark:border-white/10">
        <div className="space-y-3 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 rounded bg-zinc-950/5 dark:bg-white/5" />
          ))}
        </div>
      </div>
    </div>
  );
}
