// Skeleton de chargement — reflète la mise en page de assets/page.tsx
// (header, puis sections d'assets : titre + bouton, aperçu carré, historique).
export default function Loading() {
  return (
    <div className="animate-pulse space-y-8" aria-hidden="true">
      {/* Header */}
      <div className="min-w-0 space-y-2">
        <div className="h-3 w-48 rounded bg-white/[0.03]" />
        <div className="h-7 w-64 max-w-full rounded bg-white/[0.03]" />
        <div className="h-4 w-full max-w-2xl rounded bg-white/[0.03]" />
      </div>

      {/* Sections d'assets */}
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="h-5 w-14 rounded-md bg-white/[0.03]" />
                <div className="h-5 w-28 rounded bg-white/[0.03]" />
                <div className="h-3 w-64 max-w-full rounded bg-white/[0.03]" />
              </div>
              <div className="h-9 w-28 shrink-0 rounded-lg bg-white/[0.03]" />
            </div>
            <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[18rem_minmax(0,1fr)]">
              <div className="space-y-2">
                <div className="h-3 w-32 rounded bg-white/[0.03]" />
                <div className="aspect-square w-full rounded-lg bg-white/[0.03]" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 w-40 rounded bg-white/[0.03]" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div
                    key={j}
                    className="aspect-square rounded-lg bg-white/[0.03]"
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
