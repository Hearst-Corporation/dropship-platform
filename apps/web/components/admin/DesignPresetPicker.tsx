"use client";

import { CheckIcon } from "@heroicons/react/20/solid";
import { DESIGN_PRESETS, type DesignPreset } from "@/lib/design/presets";
import { Text } from "@/components/catalyst/text";

/**
 * Default primary/accent shown on each preset card before the operator
 * overrides them. Purely illustrative — store-creator/Claude pick the real
 * per-store colors; these just give the card something niche-agnostic to
 * render since presets only ship neutrals (`preset.neutrals`).
 */
const PREVIEW_COLORS: Record<string, { primary: string; accent: string }> = {
  "editorial-serif": { primary: "#8a6d3b", accent: "#c9a15a" },
  "tech-mono": { primary: "#e5e5e5", accent: "#22d3ee" },
  "brutalist-luxe": { primary: "#000000", accent: "#ff5a1f" },
  "gen-z-bold": { primary: "#ff2f92", accent: "#ffcc00" },
  "lifestyle-warm": { primary: "#b5651d", accent: "#e0a458" },
};

function previewFor(preset: DesignPreset) {
  return (
    PREVIEW_COLORS[preset.slug] ?? {
      primary: preset.neutrals.text,
      accent: preset.neutrals.textMuted,
    }
  );
}

interface DesignPresetPickerProps {
  /** Currently selected preset slug, or null/undefined when none picked. */
  value: string | null | undefined;
  /** Called with the new preset slug, or null when the operator clears it. */
  onChange: (slug: string | null) => void;
  className?: string;
}

/**
 * Small card grid for picking one of the 5 curated design presets
 * (`lib/design/presets.ts`). Each card shows the preset name, tagline and
 * two color swatches (primary/accent) rendered purely from palette data —
 * there are no screenshot assets for presets, unlike storefront templates.
 *
 * Independent of the storefront TEMPLATE picker (layout, 27 options) — this
 * is about color/typography mood (5 options) and has its own data source.
 */
export function DesignPresetPicker({
  value,
  onChange,
  className,
}: DesignPresetPickerProps) {
  return (
    <div className={className}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DESIGN_PRESETS.map((preset) => {
          const selected = preset.slug === value;
          const { primary, accent } = previewFor(preset);
          return (
            <button
              key={preset.slug}
              type="button"
              onClick={() => onChange(selected ? null : preset.slug)}
              aria-pressed={selected}
              className={`relative flex flex-col gap-2.5 rounded-lg border p-3 text-left transition-colors ${
                selected
                  ? "border-indigo-500 bg-indigo-500/5 ring-1 ring-indigo-500"
                  : "border-admin-border hover:border-admin-ring"
              }`}
            >
              {selected && (
                <span className="absolute right-2.5 top-2.5 flex size-5 items-center justify-center rounded-full bg-indigo-500 text-white">
                  <CheckIcon className="size-3.5" aria-hidden="true" />
                </span>
              )}

              <div className="flex items-center gap-1.5">
                <span
                  className="size-6 rounded-full ring-1 ring-black/10"
                  style={{ backgroundColor: primary }}
                  aria-hidden="true"
                />
                <span
                  className="size-6 rounded-full ring-1 ring-black/10"
                  style={{ backgroundColor: accent }}
                  aria-hidden="true"
                />
                <span
                  className="ml-1 size-6 rounded-full ring-1 ring-black/10"
                  style={{ backgroundColor: preset.neutrals.bg }}
                  aria-hidden="true"
                />
              </div>

              <div>
                <p
                  className="text-sm font-medium"
                  style={{ fontFamily: `"${preset.fonts.display.family}", serif` }}
                >
                  {preset.label}
                </p>
                <Text className="mt-0.5 text-xs leading-snug">
                  {preset.tagline}
                </Text>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
