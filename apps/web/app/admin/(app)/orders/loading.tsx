/** Skeleton miroir de la page orders : heading + action, 4 KPI, table. */
export default function Loading() {
  return (
    <div className="flex min-w-0 flex-1 animate-pulse flex-col space-y-8">
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-72 rounded-lg bg-white/[0.08]" />
          <div className="h-4 w-96 max-w-full rounded bg-white/[0.03]" />
        </div>
        <div className="h-9 w-52 rounded-lg bg-white/[0.03]" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="border-t border-white/[0.08] pt-4 border-white/[0.08]"
          >
            <div className="h-4 w-24 rounded bg-white/[0.03]" />
            <div className="mt-2 h-7 w-12 rounded bg-white/[0.08]" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/[0.08]">
        <div className="space-y-3 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 rounded bg-white/[0.03]" />
          ))}
        </div>
      </div>
    </div>
  );
}
