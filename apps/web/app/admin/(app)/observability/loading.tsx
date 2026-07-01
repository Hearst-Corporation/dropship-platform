// Skeleton de chargement — reflète la mise en page de observability/page.tsx
// (header, 6 KPIs, tableau par canal, tableau campagnes).
export default function Loading() {
  return (
    <div className="space-y-8 animate-pulse" aria-hidden="true">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-3 w-40 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-7 w-64 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-4 w-full max-w-2xl rounded bg-zinc-100 dark:bg-zinc-800/60" />
      </div>

      {/* KPIs globaux */}
      <section className="border-t border-zinc-950/10 pt-8 dark:border-white/10">
        <div className="h-5 w-40 rounded bg-zinc-200 dark:bg-zinc-800" />
        <dl className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="min-w-0 space-y-2">
              <div className="h-3 w-28 rounded bg-zinc-100 dark:bg-zinc-800/60" />
              <div className="h-6 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
          ))}
        </dl>
      </section>

      {/* Par canal */}
      <section className="border-t border-zinc-950/10 pt-8 dark:border-white/10">
        <div className="h-5 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-full rounded bg-zinc-100 dark:bg-zinc-800/60" />
          ))}
        </div>
      </section>

      {/* Campagnes */}
      <section className="border-t border-zinc-950/10 pt-8 dark:border-white/10">
        <div className="h-5 w-28 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-full rounded bg-zinc-100 dark:bg-zinc-800/60" />
          ))}
        </div>
      </section>
    </div>
  );
}
