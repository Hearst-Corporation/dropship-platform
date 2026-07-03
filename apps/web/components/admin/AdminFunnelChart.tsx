"use client";

export interface AdminFunnelStep {
  label: string;
  value: number;
}

export interface AdminFunnelChartProps {
  steps: AdminFunnelStep[];
  height?: number;
}

function EmptyState({ height }: { height: number }) {
  return (
    <div
      className="flex items-center justify-center bg-admin-surface-inset text-admin-kicker font-bold uppercase tracking-widest text-zinc-500"
      style={{ height }}
    >
      Pas encore de données
    </div>
  );
}

export default function AdminFunnelChart({
  steps,
  height = 280,
}: AdminFunnelChartProps) {
  if (!steps || steps.length === 0) {
    return <EmptyState height={height} />;
  }

  const max = Math.max(...steps.map((s) => s.value));

  return (
    <div
      className="flex w-full flex-col justify-center py-2"
      style={{ minHeight: height }}
    >
      {steps.map((step, i) => {
        const pct = max > 0 ? (step.value / max) * 100 : 0;
        const prev = i > 0 ? steps[i - 1].value : null;
        const convFromPrev =
          prev && prev > 0 ? ((step.value / prev) * 100).toFixed(1) : null;

        return (
          <div key={step.label} className="group relative flex flex-col">
            {/* Connecting line & conversion badge */}
            {i > 0 && (
              <div className="relative flex h-10 w-full items-center">
                {/* Must land exactly where the bar column starts: label width + row gap
                    (w-24/w-28 + gap-4/gap-6 = 7rem / 8.5rem). The old left-24 (6rem) base
                    value dropped the gap-4 and sat 1rem short of the bar; left-28 fixes it. */}
                <div className="absolute left-28 sm:left-[8.5rem] top-0 h-full w-px bg-admin-surface-inset" />
                <div className="absolute left-28 sm:left-[8.5rem] top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-admin-border bg-admin-surface-panel px-2 py-0.5 text-admin-kicker font-semibold text-zinc-400">
                  {convFromPrev ?? "0.0"}%
                </div>
              </div>
            )}

            {/* Bar row */}
            <div className="relative z-10 flex items-center gap-4 sm:gap-6">
              <div className="flex w-24 sm:w-28 shrink-0 flex-col text-right">
                <span className="text-admin-kicker font-bold uppercase tracking-[0.1em] text-zinc-500">
                  {step.label}
                </span>
                <span className="text-sm font-semibold tabular-nums text-white">
                  {step.value.toLocaleString("fr-FR")}
                </span>
              </div>

              <div className="relative flex h-8 flex-1 items-center">
                {/* Sharp Fill */}
                <div
                  className="relative h-full bg-indigo-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
