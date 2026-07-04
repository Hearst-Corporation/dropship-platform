import { useMemo } from 'react';
import { DESIGN_PRESETS } from '@/lib/design/presets';
import type { DesignProposal } from './types';

/**
 * This card renders `DesignProposal[]` — always exactly 3 AI-curated
 * candidates (per the `shortlist_niche` tool contract in
 * research/tools.ts), each carrying concrete `primary`/`accent` hex codes
 * and a per-store `rationale`. That's a narrower, differently-shaped job
 * than `components/admin/DesignPresetPicker.tsx` (browse all 25 presets by
 * slug only, no primary/accent). The two don't share a data shape, so this
 * stays a bespoke renderer — but it reuses `DESIGN_PRESETS` itself as the
 * single source of truth for a preset's label/tagline/display font instead
 * of re-declaring another copy of that catalog here.
 */
const PRESET_BY_SLUG = new Map(DESIGN_PRESETS.map((p) => [p.slug, p]));

function labelFor(slug: DesignProposal['preset']) {
  const preset = PRESET_BY_SLUG.get(slug);
  return {
    label: preset?.label ?? slug,
    tagline: preset?.tagline ?? '',
  };
}

function displayFontFor(slug: DesignProposal['preset']) {
  const preset = PRESET_BY_SLUG.get(slug);
  if (!preset) return 'Georgia, serif';
  const { family, italic } = preset.fonts.display;
  return `'${family}', ${italic ? 'Georgia, serif' : 'system-ui, sans-serif'}`;
}

export function DesignPickerBlock({
  proposals,
  selected,
  onSelect,
}: {
  proposals: DesignProposal[];
  selected: DesignProposal | null;
  onSelect: (p: DesignProposal) => void;
}) {
  // Look up label/tagline/font once per proposals array, not per render of
  // every card — proposals is fixed at 3 entries but this keeps the pattern
  // cheap regardless.
  const meta = useMemo(
    () =>
      proposals.map((p) => ({
        ...labelFor(p.preset),
        displayFont: displayFontFor(p.preset),
      })),
    [proposals],
  );

  return (
    <div className="space-y-2">
      <p className="text-kicker uppercase tracking-cta font-medium" style={{ color: 'var(--ct-text-muted)' }}>
        Design system — choisis l&apos;ambiance
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {proposals.map((p, i) => {
          const isActive =
            selected?.preset === p.preset &&
            selected.primary === p.primary &&
            selected.accent === p.accent;
          const { label, tagline, displayFont } = meta[i];
          return (
            <button
              key={`${p.preset}-${p.primary}`}
              type="button"
              onClick={() => onSelect(p)}
              className="text-left rounded-xl overflow-hidden transition-all"
              style={{
                border: isActive ? '1px solid var(--ct-text-primary)' : '1px solid var(--ct-border)',
                background: 'var(--ct-surface-1)',
                boxShadow: isActive ? '0 0 0 2px var(--ct-border-strong)' : 'none',
              }}
              aria-pressed={isActive}
            >
              {/* Sample */}
              <div
                className="px-3 py-3 flex items-baseline gap-2"
                style={{ background: p.primary }}
              >
                <span
                  className="text-xl text-white leading-none"
                  style={{ fontFamily: displayFont, fontStyle: 'italic' }}
                >
                  Aa
                </span>
                <span
                  className="text-[11px] uppercase tracking-cta text-white/70 font-medium"
                  style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                >
                  Sample
                </span>
                <span
                  className="ml-auto w-4 h-4 rounded-full border border-white/40"
                  style={{ background: p.accent }}
                  aria-hidden
                />
              </div>
              {/* Body */}
              <div className="px-3 py-2.5 space-y-1">
                <p className="text-[13px] font-semibold leading-tight" style={{ color: 'var(--ct-text-primary)' }}>
                  {label}
                </p>
                <p className="text-[11px] leading-snug line-clamp-2" style={{ color: 'var(--ct-text-muted)' }}>
                  {tagline}
                </p>
                <div className="flex items-center gap-1.5 pt-1">
                  <span
                    className="inline-block w-3 h-3 rounded-sm"
                    style={{ background: p.primary, border: '1px solid var(--ct-border)' }}
                    aria-hidden
                  />
                  <span className="text-[10px] tabular-nums uppercase" style={{ color: 'var(--ct-text-muted)' }}>{p.primary}</span>
                  <span
                    className="inline-block w-3 h-3 rounded-sm ml-1.5"
                    style={{ background: p.accent, border: '1px solid var(--ct-border)' }}
                    aria-hidden
                  />
                  <span className="text-[10px] tabular-nums uppercase" style={{ color: 'var(--ct-text-muted)' }}>{p.accent}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {selected?.rationale && (
        <p className="text-xs leading-relaxed italic" style={{ color: 'var(--ct-text-muted)' }}>{selected.rationale}</p>
      )}
    </div>
  );
}
