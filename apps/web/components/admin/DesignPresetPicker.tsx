"use client";

import { CheckIcon } from "@heroicons/react/20/solid";
import { ACCENTS, type Accent } from "@/lib/accent";
import { Text } from "@/components/ui/text";

/**
 * Accent picker. The old per-store design "presets" are gone — the storefront
 * now renders through the unified Catalyst design system, and the only visual
 * choice a store carries is its brand accent (indigo by default). Same
 * value/onChange API as before so the store-creation flow is untouched.
 */
const ACCENT_SWATCH: Record<Accent, { hex: string; label: string }> = {
  indigo: { hex: "#4f46e5", label: "Indigo" },
  fuchsia: { hex: "#912268", label: "Fuchsia" },
  bordeaux: { hex: "#912234", label: "Bordeaux" },
  amber: { hex: "#916822", label: "Ambre" },
  emerald: { hex: "#229162", label: "Émeraude" },
  teal: { hex: "#229191", label: "Teal" },
  blue: { hex: "#225091", label: "Bleu" },
  violet: { hex: "#502291", label: "Violet" },
};

interface DesignPresetPickerProps {
  /** Currently selected accent name, or null/undefined when none picked. */
  value: string | null | undefined;
  /** Called with the new accent name, or null when cleared. */
  onChange: (slug: string | null) => void;
  className?: string;
}

export function DesignPresetPicker({ value, onChange, className }: DesignPresetPickerProps) {
  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ACCENTS.map((accent) => {
          const selected = accent === value;
          const { hex, label } = ACCENT_SWATCH[accent];
          return (
            <button
              key={accent}
              type="button"
              onClick={() => onChange(selected ? null : accent)}
              className={`relative flex items-center gap-2.5 rounded-lg border p-3 text-left transition ${
                selected
                  ? "border-accent-500 ring-1 ring-accent-500"
                  : "border-zinc-950/10 hover:border-zinc-950/20 dark:border-white/10 dark:hover:border-white/20"
              }`}
            >
              <span
                aria-hidden
                className="size-5 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/15"
                style={{ background: hex }}
              />
              <Text className="!text-sm font-medium">{label}</Text>
              {selected && <CheckIcon className="ml-auto size-4 text-accent-600" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
