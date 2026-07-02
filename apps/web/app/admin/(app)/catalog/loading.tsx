/**
 * Skeleton for /admin/catalog, faithful to the final layout: page header
 * (AdminPageHeader, pb-6), toolbar (search + status filter), then the bordered
 * table panel with 8 dense rows (thumbnail + title + right-aligned price).
 * Zinc-only palette, light + dark.
 */
export default function Loading() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <span className="sr-only">Chargement du catalogue…</span>
      <div className="animate-pulse" aria-hidden="true">
        {/* Header: title + subtitle + meta strip */}
        <div className="pb-6">
          <div className="h-8 w-56 max-w-full rounded-lg bg-white/[0.08]" />
          <div className="mt-2 h-4 w-96 max-w-full rounded bg-white/[0.03]" />
          <div className="mt-3 h-3 w-48 max-w-full rounded bg-white/[0.03]" />
        </div>

        {/* Toolbar: search input + status filter */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="h-9 w-full max-w-xs rounded-lg bg-white/[0.03]" />
          <div className="h-9 w-40 rounded-lg bg-white/[0.03]" />
        </div>

        {/* Table panel: 8 dense rows */}
        <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03]">
          <div className="divide-y divide-zinc-950/5 dark:divide-white/5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-6 py-2.5">
                <div className="size-10 shrink-0 rounded-lg bg-white/[0.08]" />
                <div className="h-4 w-1/3 rounded bg-white/[0.03]" />
                <div className="ml-auto h-4 w-16 rounded bg-white/[0.03]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
