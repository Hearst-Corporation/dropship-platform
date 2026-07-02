// Skeleton de chargement — reflète la mise en page de observability/page.tsx :
// header AdminPageHeader, 4 KPIs IA, deux panneaux IA (coût par modèle + runs
// récents), puis la zone campagnes (subheading, 6 KPIs, panneau par canal,
// panneau campagnes).

function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-admin-border bg-admin-surface-inset p-4">
      <div className="h-3 w-24 rounded bg-admin-surface-inset" />
      <div className="mt-3 h-7 w-20 rounded bg-admin-surface-inset" />
    </div>
  );
}

function TablePanelSkeleton({ rows }: { rows: number }) {
  return (
    <div className="rounded-xl border border-admin-border bg-admin-surface-inset">
      <div className="border-b border-admin-border px-5 py-4 sm:px-6 border-admin-border">
        <div className="h-4 w-28 rounded bg-admin-surface-inset" />
        <div className="mt-1.5 h-3 w-56 max-w-full rounded bg-admin-surface-inset" />
      </div>
      <div className="space-y-3 p-5 sm:p-6">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-9 w-full rounded bg-admin-surface-inset" />
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="animate-pulse space-y-8" aria-hidden="true">
      {/* Header (AdminPageHeader) */}
      <div className="space-y-2 pb-6">
        <div className="h-7 w-52 rounded bg-admin-surface-inset" />
        <div className="h-4 w-full max-w-2xl rounded bg-admin-surface-inset" />
      </div>

      {/* KPIs IA (30 jours) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Coût par modèle + runs récents */}
      <div className="grid grid-cols-1 items-start gap-8 2xl:grid-cols-2">
        <TablePanelSkeleton rows={4} />
        <TablePanelSkeleton rows={6} />
      </div>

      {/* Zone campagnes */}
      <div className="space-y-6 border-t border-admin-border pt-8 border-admin-border">
        <div className="space-y-2">
          <div className="h-5 w-52 rounded bg-admin-surface-inset" />
          <div className="h-4 w-full max-w-2xl rounded bg-admin-surface-inset" />
        </div>

        {/* KPIs campagnes */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>

        {/* Par canal */}
        <TablePanelSkeleton rows={4} />

        {/* Campagnes */}
        <TablePanelSkeleton rows={5} />
      </div>
    </div>
  );
}
