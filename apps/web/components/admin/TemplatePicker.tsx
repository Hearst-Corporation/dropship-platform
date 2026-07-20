"use client";

import { useMemo, useState } from "react";
import { Squares2X2Icon } from "@heroicons/react/24/outline";
import {
  TEMPLATE_CATALOG,
  REGISTER_LABEL,
  type StoreTemplate,
  type TemplateRegister,
} from "@/lib/template-catalog";
import { cn } from "@/lib/utils/cn";
import { AdminToolbar } from "@/components/admin/AdminToolbar";
import { Badge } from "@/components/catalyst/badge";
import { Text, Code, Strong } from "@/components/catalyst/text";

const REGISTER_BADGE_COLOR: Record<TemplateRegister, "amber" | "indigo" | "zinc"> = {
  luxury: "amber",
  premium: "indigo",
  mass: "zinc",
};

const REGISTER_FILTER_OPTIONS = [
  { label: "Tous les registres", value: "all" },
  { label: "Luxe", value: "luxury" },
  { label: "Premium", value: "premium" },
  { label: "Mass-market", value: "mass" },
];

export interface TemplatePickerProps {
  /** Currently selected template id. */
  value: StoreTemplate;
  /** Called with the new template id when the operator picks a card. */
  onChange: (id: StoreTemplate) => void;
  /** Exclude the 'auto' meta-entry from the grid (it has no preview/layout of its own). */
  excludeAuto?: boolean;
  /** Disable interaction (e.g. while a save is pending). */
  disabled?: boolean;
  className?: string;
}

/**
 * Visual grid picker for storefront templates — shows the rendered preview
 * screenshot, label, hint and register badge for every entry in
 * TEMPLATE_CATALOG, with search + register filter since there are 27+
 * templates. Luxury templates are included (operator opt-in path — they're
 * excluded from *auto*-suggestion in suggestTemplate(), not from manual pick).
 *
 * Pure presentational client component: all state (selection) is owned by
 * the parent via value/onChange, same pattern as AdminToolbar.
 */
export function TemplatePicker({
  value,
  onChange,
  excludeAuto = true,
  disabled = false,
  className,
}: TemplatePickerProps) {
  const [search, setSearch] = useState("");
  const [register, setRegister] = useState<"all" | TemplateRegister>("all");

  const entries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return TEMPLATE_CATALOG.filter((t) => {
      if (excludeAuto && t.id === "auto") return false;
      if (register !== "all" && t.register !== register) return false;
      if (!q) return true;
      const haystack = `${t.label} ${t.hint} ${t.id} ${t.niches.join(" ")}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [search, register, excludeAuto]);

  return (
    <div className={cn("space-y-4", className)}>
      <AdminToolbar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Rechercher un template…",
        }}
        filters={[
          {
            label: "Registre",
            value: register,
            onChange: (v) => setRegister(v as "all" | TemplateRegister),
            options: REGISTER_FILTER_OPTIONS,
          },
        ]}
        count={`${entries.length} template${entries.length > 1 ? "s" : ""}`}
      />

      <div className="grid max-h-[32rem] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
        {entries.map((t) => {
          const active = value === t.id;
          const preview =
            t.id === "auto" ? null : `/template-previews/${t.id}-rendered.png`;
          return (
            <button
              key={t.id}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => onChange(t.id as StoreTemplate)}
              className={cn(
                "relative flex min-w-0 flex-col overflow-hidden rounded-lg text-left ring-1 transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                active
                  ? "ring-2 ring-indigo-500"
                  : "ring-admin-ring hover:ring-admin-ring-strong",
              )}
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-admin-surface-panel">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview}
                    alt={t.label}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover object-top"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-admin-surface-panel">
                    <Squares2X2Icon
                      className="size-6 text-zinc-400"
                      aria-hidden="true"
                    />
                    <span className="text-xs font-medium text-zinc-500">
                      Auto
                    </span>
                  </div>
                )}
                {active && (
                  <span
                    className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-indigo-400 ring-2 ring-white/80"
                    aria-hidden
                  />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 bg-admin-surface-panel p-3">
                <div className="flex items-start justify-between gap-2">
                  <Strong className="truncate text-sm">{t.label}</Strong>
                  <Badge color={REGISTER_BADGE_COLOR[t.register]}>
                    {REGISTER_LABEL[t.register]}
                  </Badge>
                </div>
                <Text className="line-clamp-2 !text-xs">{t.hint}</Text>
                <Code className="mt-auto truncate !text-[11px]">{t.id}</Code>
              </div>
            </button>
          );
        })}

        {entries.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center gap-2 rounded-lg py-12 ring-1 ring-admin-ring">
            <Squares2X2Icon className="size-6 text-zinc-400" aria-hidden="true" />
            <Text className="!text-xs">Aucun template ne correspond.</Text>
          </div>
        )}
      </div>
    </div>
  );
}
