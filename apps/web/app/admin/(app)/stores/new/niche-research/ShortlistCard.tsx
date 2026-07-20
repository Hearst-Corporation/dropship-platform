import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { adminBgInset, adminBgPanel, adminBorder, adminText, adminTextMuted } from '@/components/admin/admin-surface';
import { cn } from '@/lib/utils/cn';
import { DesignPickerBlock } from './DesignPickerBlock';
import { MediaPlanBlock } from './MediaPlanBlock';
import type { DesignProposal, ShortlistPayload } from './types';

export function ShortlistCard({
  payload,
  onApply,
}: {
  payload: ShortlistPayload;
  onApply: (p: ShortlistPayload) => void;
}) {
  // The picker selection is local to the card — we don't persist it in the
  // chat history. Defaults to the first proposal so a single-click flow still
  // works (operator sees the first design highlighted, clicks "Lancer").
  const [selectedDesign, setSelectedDesign] = useState<DesignProposal | null>(
    payload.design_proposals?.[0] ?? null,
  );
  const sat = payload.saturation;
  const cautious = sat != null && sat <= 70;
  const fp = payload.featured_product;
  const fpCost = fp ? (fp.cost_cents / 100).toFixed(2) : null;
  const fpPrice = fp ? (fp.suggested_price_cents / 100).toFixed(2) : null;
  const fpMargin = fp ? ((fp.suggested_price_cents - fp.cost_cents) / 100).toFixed(2) : null;

  return (
    <div
      className={cn(
        "rounded-xl border px-5 py-4 space-y-4 min-w-0 max-w-full",
        cautious ? "border-amber-500/40 bg-amber-500/5" : cn(adminBorder, adminBgPanel),
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className={cn("text-[10px] uppercase tracking-wide font-semibold", adminTextMuted)}>
          Recommandation IA
        </p>
        {sat != null && (
          <span className={cn("text-xs", adminTextMuted)}>Saturation {sat}/100</span>
        )}
      </div>
      <h3 className={cn("font-semibold tracking-tight text-xl", adminText)}>
        <em className="italic">{payload.niche}</em>
      </h3>
      <p className={cn("text-sm leading-relaxed whitespace-pre-wrap", adminTextMuted)}>
        {payload.rationale}
      </p>

      {/* Featured product — image + supplier-grade meta. This is the
          piece the operator wants to actually SEE before committing
          to the niche. */}
      {fp && (
        <a
          href={fp.supplier_url}
          target="_blank"
          rel="noreferrer noopener"
          className={cn(
            "group flex gap-3 items-stretch rounded-xl border transition-colors overflow-hidden",
            adminBorder,
            adminBgInset,
          )}
        >
          <div className={cn("w-28 sm:w-32 shrink-0 aspect-square overflow-hidden", adminBgInset)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fp.image_url}
              alt={fp.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              loading="lazy"
            />
          </div>
          <div className="flex-1 min-w-0 py-3 pr-3 space-y-1.5">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide">
              <Badge color={fp.supplier === 'cj' ? 'indigo' : 'zinc'}>{fp.supplier}</Badge>
              {fp.orders != null && (
                <span className={cn("tabular-nums", adminTextMuted)}>{fp.orders} cmd</span>
              )}
              {fp.rating && (
                <span className={cn("tabular-nums", adminTextMuted)}>★ {fp.rating}</span>
              )}
            </div>
            <p className={cn("text-sm font-medium line-clamp-2 leading-tight", adminText)}>
              {fp.title}
            </p>
            <div className="flex items-baseline gap-3 text-xs tabular-nums">
              <span className={adminTextMuted}>{fpCost} €</span>
              <span className={adminTextMuted}>→</span>
              <span className={cn("font-semibold", adminText)}>{fpPrice} €</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">+{fpMargin} €</span>
              {fp.expected_aov_eur != null && (
                <span className={cn("ml-auto", adminTextMuted)}>AOV ~{fp.expected_aov_eur} €</span>
              )}
            </div>
            {fp.pricing_rationale && (
              <p className={cn("text-xs leading-snug line-clamp-2 italic", adminTextMuted)}>
                {fp.pricing_rationale}
              </p>
            )}
            {fp.why_this_one && (
              <p className={cn("text-xs leading-snug line-clamp-2", adminTextMuted)}>{fp.why_this_one}</p>
            )}
          </div>
        </a>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className={cn("rounded-lg border p-3", adminBorder, adminBgInset)}>
          <p className={cn("text-[10px] uppercase tracking-wide font-semibold", adminTextMuted)}>Nom suggéré</p>
          <p className={cn("mt-1 font-medium", adminText)}>{payload.suggested_store_name}</p>
        </div>
        {payload.estimated_aov_eur != null && (
          <div className={cn("rounded-lg border p-3", adminBorder, adminBgInset)}>
            <p className={cn("text-[10px] uppercase tracking-wide font-semibold", adminTextMuted)}>AOV estimé</p>
            <p className={cn("mt-1 font-medium", adminText)}>
              {payload.estimated_aov_eur.toLocaleString('fr-FR', {
                style: 'currency',
                currency: 'EUR',
                maximumFractionDigits: 0,
              })}
            </p>
          </div>
        )}
      </div>
      {payload.target_audience && (
        <p className={cn("text-xs leading-relaxed", adminTextMuted)}>
          <span className={cn("font-medium", adminText)}>Cible : </span>
          {payload.target_audience}
        </p>
      )}
      {payload.media_plan && <MediaPlanBlock plan={payload.media_plan} />}

      {payload.design_proposals && payload.design_proposals.length > 0 && (
        <DesignPickerBlock
          proposals={payload.design_proposals}
          selected={selectedDesign}
          onSelect={setSelectedDesign}
        />
      )}

      <div className={cn("sticky bottom-0 -mx-5 -mb-4 px-5 pt-3 pb-4", adminBgPanel)}>
        <Button
          type="button"
          color="indigo"
          className="w-full justify-center"
          onClick={() =>
            onApply({
              ...payload,
              // Carry the picker's choice to the parent. If the agent
              // didn't propose any design we just send the payload as-is
              // — the store-creator will fall back to its default preset.
              design_proposals: selectedDesign ? [selectedDesign] : payload.design_proposals,
            })
          }
        >
          Lancer cette niche →
        </Button>
      </div>
    </div>
  );
}
