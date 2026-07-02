// Skeleton de chargement — reflète la mise en page de settings/page.tsx
// (header + carte identifiants fournisseurs + carte politique/table).
export default function Loading() {
  return (
    <div className="space-y-8 animate-pulse" aria-hidden="true">
      {/* Header */}
      <div className="space-y-2 pb-6">
        <div className="h-7 w-48 rounded bg-admin-surface-inset" />
        <div className="h-4 w-full max-w-md rounded bg-admin-surface-inset" />
        <div className="h-3 w-64 rounded bg-admin-surface-inset" />
      </div>

      {/* Carte identifiants fournisseurs */}
      <div className="rounded-xl border border-admin-border bg-admin-surface-inset">
        <div className="border-b border-admin-border px-6 py-4 border-admin-border">
          <div className="h-4 w-56 rounded bg-admin-surface-inset" />
          <div className="mt-2 h-3 w-80 rounded bg-admin-surface-inset" />
        </div>
        <div className="divide-y divide-zinc-950/10 p-6 dark:divide-white/10">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="py-5 first:pt-0 last:pb-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="h-4 w-40 rounded bg-admin-surface-inset" />
                  <div className="h-3 w-56 rounded bg-admin-surface-inset" />
                </div>
                <div className="h-9 w-28 rounded-lg bg-admin-surface-inset" />
              </div>
              <div className="mt-3 h-4 w-full max-w-xl rounded bg-admin-surface-inset" />
            </div>
          ))}
        </div>
      </div>

      {/* Carte politique dropshipping (table) */}
      <div className="rounded-xl border border-admin-border bg-admin-surface-inset">
        <div className="border-b border-admin-border px-6 py-4 border-admin-border">
          <div className="h-4 w-52 rounded bg-admin-surface-inset" />
          <div className="mt-2 h-3 w-96 max-w-full rounded bg-admin-surface-inset" />
        </div>
        <div className="px-6">
          <div className="flex h-9 items-center border-b border-admin-border">
            <div className="h-3 w-2/3 rounded bg-admin-surface-inset" />
          </div>
          <div className="divide-y divide-zinc-950/5 dark:divide-white/5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex h-10 items-center">
                <div className="h-3 w-full rounded bg-admin-surface-inset" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
