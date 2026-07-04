import { adminBgInset, adminBorder, adminText, adminTextMuted } from '@/components/admin/admin-surface';
import { cn } from '@/lib/utils/cn';
import { Metric } from './renderers';
import type { MediaChannel, MediaPlan } from './types';

const CHANNEL_COLOR: Record<MediaChannel['name'], string> = {
  meta: 'bg-blue-600',
  tiktok: 'bg-zinc-900',
  google: 'bg-blue-300',
  pinterest: 'bg-zinc-400',
};

const CHANNEL_LABEL: Record<MediaChannel['name'], string> = {
  meta: 'Meta',
  tiktok: 'TikTok',
  google: 'Google',
  pinterest: 'Pinterest',
};

export function MediaPlanBlock({ plan }: { plan: MediaPlan }) {
  const totalWeight = plan.channels.reduce((acc, c) => acc + c.weight_pct, 0) || 100;
  return (
    <div className={cn("pt-4 space-y-4 border-t", adminBorder)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className={cn("text-[10px] uppercase tracking-wide font-semibold", adminTextMuted)}>
          Plan média
        </p>
        <span className={cn("text-xs tabular-nums", adminTextMuted)}>
          {plan.daily_budget_eur.toLocaleString('fr-FR')} € / jour
        </span>
      </div>

      {/* Channel mix — stacked horizontal bar */}
      <div>
        <div className={cn("flex h-2 rounded-full overflow-hidden", adminBgInset)}>
          {plan.channels.map((c) => (
            <div
              key={c.name}
              className={CHANNEL_COLOR[c.name]}
              style={{ width: `${(c.weight_pct / totalWeight) * 100}%` }}
              title={`${CHANNEL_LABEL[c.name]} ${c.weight_pct}%`}
            />
          ))}
        </div>
        <ul className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {plan.channels.map((c) => (
            <li key={c.name} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${CHANNEL_COLOR[c.name]}`} />
              <span className={cn("font-medium", adminTextMuted)}>{CHANNEL_LABEL[c.name]}</span>
              <span className={cn("tabular-nums", adminTextMuted)}>{c.weight_pct}%</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Outcomes */}
      <div className={cn("grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs rounded-lg border p-3", adminBorder, adminBgInset)}>
        <Metric label="CPA cible" value={`${plan.expected_outcomes.target_cpa_eur.toFixed(0)} €`} />
        <Metric label="ROAS cible" value={`×${plan.expected_outcomes.target_roas.toFixed(1)}`} />
        <Metric
          label="Cmd / jour"
          value={`${plan.expected_outcomes.daily_orders_low}–${plan.expected_outcomes.daily_orders_high}`}
        />
        <Metric
          label="Budget"
          value={`${plan.daily_budget_eur.toLocaleString('fr-FR')} €`}
        />
      </div>
      {plan.expected_outcomes.breakeven_note && (
        <p className={cn("text-xs italic leading-snug", adminTextMuted)}>
          {plan.expected_outcomes.breakeven_note}
        </p>
      )}

      {/* Geo + audience side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className={cn("rounded-lg border p-3", adminBorder, adminBgInset)}>
          <p className={cn("text-[10px] uppercase tracking-wide font-semibold mb-1.5", adminTextMuted)}>Géo</p>
          <p className={cn("font-medium", adminText)}>{plan.geo.primary_countries.join(' · ')}</p>
          {plan.geo.emphasis && plan.geo.emphasis.length > 0 && (
            <p className={cn("mt-1", adminTextMuted)}>
              Focus : {plan.geo.emphasis.join(', ')}
            </p>
          )}
          {plan.geo.rationale && (
            <p className={cn("mt-1 leading-snug", adminTextMuted)}>{plan.geo.rationale}</p>
          )}
        </div>
        <div className={cn("rounded-lg border p-3", adminBorder, adminBgInset)}>
          <p className={cn("text-[10px] uppercase tracking-wide font-semibold mb-1.5", adminTextMuted)}>Audience</p>
          <p className={cn("leading-snug", adminTextMuted)}>{plan.audience.demographics}</p>
          {plan.audience.interests.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {plan.audience.interests.slice(0, 6).map((i) => (
                <span
                  key={i}
                  className={cn("inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px]", adminBorder, adminTextMuted)}
                >
                  {i}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Schedule */}
      <div className={cn("rounded-lg border p-3 text-xs", adminBorder, adminBgInset)}>
        <p className={cn("text-[10px] uppercase tracking-wide font-semibold mb-1.5", adminTextMuted)}>Horaires</p>
        <p className={adminTextMuted}>
          <span className={cn("font-medium", adminText)}>{plan.schedule.best_hours_local.join(' · ')}</span>
          <span className="mx-1.5">·</span>
          {plan.schedule.best_days.join(', ')}
          {plan.schedule.timezone && (
            <span className="ml-1.5">({plan.schedule.timezone})</span>
          )}
        </p>
        {plan.schedule.rationale && (
          <p className="mt-1 leading-snug">{plan.schedule.rationale}</p>
        )}
      </div>

      {/* Top hooks */}
      {plan.top_hooks && plan.top_hooks.length > 0 && (
        <div>
          <p className={cn("text-[10px] uppercase tracking-wide font-semibold mb-2", adminTextMuted)}>Hooks créatifs</p>
          <ul className="space-y-1.5">
            {plan.top_hooks.slice(0, 3).map((h, i) => (
              <li key={i} className="flex items-baseline gap-2 text-xs">
                <span className={cn("tabular-nums shrink-0", adminTextMuted)}>{(i + 1).toString().padStart(2, '0')}</span>
                <span className={cn("leading-snug", adminTextMuted)}>«&nbsp;{h}&nbsp;»</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
