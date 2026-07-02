/**
 * Global admin loading state: a pulse skeleton mirroring the common page
 * anatomy (page header, KPI strip, table rows) so navigation between
 * sections never flashes an empty screen.
 */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="space-y-2">
        <div className="h-8 w-56 rounded-lg bg-zinc-950/5 dark:bg-white/5" />
        <div className="h-4 w-80 rounded bg-zinc-950/5 dark:bg-white/5" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-zinc-950/5 dark:bg-white/5" />
        ))}
      </div>
      <div className="space-y-2 rounded-xl border border-zinc-950/10 p-6 dark:border-white/10">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 rounded-md bg-zinc-950/5 dark:bg-white/5" />
        ))}
      </div>
    </div>
  );
}
