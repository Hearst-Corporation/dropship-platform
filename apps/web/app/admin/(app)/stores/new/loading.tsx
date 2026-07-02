export default function Loading() {
  return (
    <div className="animate-pulse space-y-8">
      {/* Back link + header */}
      <div className="space-y-2 pb-6">
        <div className="h-4 w-20 rounded bg-admin-surface-inset" />
        <div className="h-8 w-56 rounded-lg bg-admin-surface-inset" />
        <div className="h-4 w-96 max-w-full rounded bg-admin-surface-inset" />
      </div>

      {/* Formulaire centré */}
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="h-6 w-44 rounded bg-admin-surface-inset" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-admin-surface-inset" />
        ))}
        <div className="flex items-center justify-end gap-3 border-t border-admin-border pt-6 border-admin-border">
          <div className="h-9 w-24 rounded-lg bg-admin-surface-inset" />
          <div className="h-9 w-32 rounded-lg bg-admin-surface-inset" />
        </div>
      </div>
    </div>
  );
}
