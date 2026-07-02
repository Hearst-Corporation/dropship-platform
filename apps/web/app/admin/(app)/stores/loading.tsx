export default function Loading() {
  return (
    <div className="animate-pulse space-y-8">
      {/* Header: titre + sous-titre + meta, action à droite */}
      <div className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-64 rounded-lg bg-zinc-100 dark:bg-white/5" />
          <div className="h-4 w-96 max-w-full rounded bg-zinc-100 dark:bg-white/5" />
          <div className="h-3 w-40 rounded bg-zinc-100 dark:bg-white/5" />
        </div>
        <div className="h-9 w-36 shrink-0 rounded-lg bg-zinc-100 dark:bg-white/5" />
      </div>

      {/* 4 stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-xl border border-zinc-950/10 bg-white dark:border-white/10 dark:bg-zinc-900"
          />
        ))}
      </div>

      {/* Toolbar (recherche + filtre statut) puis table */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="h-9 w-full max-w-xs rounded-lg bg-zinc-100 dark:bg-white/5" />
          <div className="h-9 w-40 rounded-lg bg-zinc-100 dark:bg-white/5" />
        </div>
        <div className="h-96 rounded-xl border border-zinc-950/10 bg-white dark:border-white/10 dark:bg-zinc-900" />
      </div>
    </div>
  );
}
