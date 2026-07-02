/**
 * Global admin loading state: a pulse skeleton mirroring the common page
 * anatomy (page header, KPI strip, table rows) so navigation between
 * sections never flashes an empty screen.
 */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="space-y-2">
        <div className="h-8 w-56 rounded-lg bg-white/[0.03]" />
        <div className="h-4 w-80 rounded bg-white/[0.03]" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-white/[0.03]" />
        ))}
      </div>
      <div className="space-y-2 rounded-xl border border-white/[0.08] p-6 border-white/[0.08]">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 rounded-md bg-white/[0.03]" />
        ))}
      </div>
    </div>
  );
}
