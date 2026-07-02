// Skeleton de chargement — reflète la mise en page de page.tsx
// (header avatar + titre, indicateurs, informations, catalogue).
export default function Loading() {
  return (
    <div className="animate-pulse space-y-8" aria-hidden="true">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="h-3 w-20 rounded bg-white/[0.03]" />
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-white/[0.03]" />
            <div className="h-7 w-48 rounded bg-white/[0.03]" />
          </div>
          <div className="h-4 w-72 rounded bg-white/[0.03]" />
        </div>
        <div className="h-9 w-32 rounded-lg bg-white/[0.03]" />
      </div>

      {/* Indicateurs */}
      <div>
        <div className="h-5 w-28 rounded bg-white/[0.03]" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-6">
              <div className="h-4 w-28 rounded bg-white/[0.03]" />
              <div className="h-4 w-20 rounded bg-white/[0.03]" />
            </div>
          ))}
        </div>
      </div>

      {/* Informations */}
      <div className="border-t border-white/[0.08] pt-8 border-white/[0.08]">
        <div className="flex items-start justify-between gap-4">
          <div className="h-5 w-32 rounded bg-white/[0.03]" />
          <div className="h-5 w-16 rounded-md bg-white/[0.03]" />
        </div>
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-6">
              <div className="h-4 w-24 rounded bg-white/[0.03]" />
              <div className="h-4 w-40 rounded bg-white/[0.03]" />
            </div>
          ))}
        </div>
      </div>

      {/* Catalogue */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.08] pt-8 border-white/[0.08]">
        <div className="space-y-2">
          <div className="h-5 w-28 rounded bg-white/[0.03]" />
          <div className="h-4 w-48 rounded bg-white/[0.03]" />
        </div>
        <div className="h-9 w-40 rounded-lg bg-white/[0.03]" />
      </div>
    </div>
  );
}
