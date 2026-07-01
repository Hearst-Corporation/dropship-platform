// Skeleton de chargement — reflète la mise en page de catalog/page.tsx
// (header, 4 stats aperçu, tableau produits).
export default function Loading() {
  return (
    <div className="space-y-8 animate-pulse" aria-hidden="true">
      {/* Header */}
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="h-3 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-7 w-56 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-4 w-80 rounded bg-zinc-100 dark:bg-zinc-800/60" />
        </div>
        <div className="h-9 w-48 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      </div>

      {/* Aperçu — stats */}
      <div className="border-t border-zinc-950/10 pt-8 dark:border-white/10">
        <div className="h-5 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
        <dl className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-28 rounded bg-zinc-100 dark:bg-zinc-800/60" />
              <div className="h-6 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
          ))}
        </dl>
      </div>

      {/* Tableau produits */}
      <div className="border-t border-zinc-950/10 pt-8 dark:border-white/10">
        <div className="h-5 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="size-10 shrink-0 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-8 flex-1 rounded bg-zinc-100 dark:bg-zinc-800/60" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
