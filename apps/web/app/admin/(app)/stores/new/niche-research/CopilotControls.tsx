import { Checkbox, CheckboxField } from '@/components/catalyst/checkbox';
import { Label } from '@/components/catalyst/fieldset';
import {
  adminBgInset,
  adminBorder,
  adminText,
  adminTextMuted,
} from '@/components/admin/admin-surface';
import { cn } from '@/lib/utils/cn';
import type { CostSummary } from './types';
import { fmtEur } from './utils';

interface CopilotControlsProps {
  mode: 'mono' | 'collection';
  onModeChange: (mode: 'mono' | 'collection') => void;
  language: 'fr' | 'en';
  onLanguageChange: (lang: 'fr' | 'en') => void;
  skipVideo: boolean;
  onSkipVideoChange: (skip: boolean) => void;
  cost: CostSummary;
}

function SegmentedButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
        active ? "bg-indigo-500 text-white" : cn(adminTextMuted, "hover:text-zinc-100"),
      )}
    >
      {children}
    </button>
  );
}

/**
 * Horizontal control strip rendered above the chat (replaces the old
 * right-hand sidebar). Groups Format / Langue / Vidéo promo and the live
 * session cost on one row so the chat itself spans full width.
 */
export function CopilotControls({
  mode,
  onModeChange,
  language,
  onLanguageChange,
  skipVideo,
  onSkipVideoChange,
  cost,
}: CopilotControlsProps) {
  return (
    <div className={cn("shrink-0 border-b px-4 py-2 flex flex-wrap items-center gap-x-5 gap-y-2", adminBorder)}>
      {/* Format */}
      <div className="flex items-center gap-2">
        <span className={cn("text-[10px] uppercase tracking-wide font-semibold", adminTextMuted)}>
          Format
        </span>
        <div className={cn("flex gap-1 rounded-lg p-0.5", adminBgInset)}>
          <SegmentedButton active={mode === 'mono'} onClick={() => onModeChange('mono')}>
            Mono
          </SegmentedButton>
          <SegmentedButton active={mode === 'collection'} onClick={() => onModeChange('collection')}>
            Collection
          </SegmentedButton>
        </div>
      </div>

      {/* Langue */}
      <div className="flex items-center gap-2">
        <span className={cn("text-[10px] uppercase tracking-wide font-semibold", adminTextMuted)}>
          Langue
        </span>
        <div className={cn("flex gap-1 rounded-lg p-0.5", adminBgInset)}>
          <SegmentedButton active={language === 'fr'} onClick={() => onLanguageChange('fr')}>
            FR
          </SegmentedButton>
          <SegmentedButton active={language === 'en'} onClick={() => onLanguageChange('en')}>
            EN
          </SegmentedButton>
        </div>
      </div>

      {/* Vidéo promo (mono only) */}
      {mode === 'mono' && (
        <CheckboxField>
          <Checkbox checked={!skipVideo} onChange={(checked) => onSkipVideoChange(!checked)} />
          <Label className="!text-xs">Vidéo promo</Label>
        </CheckboxField>
      )}

      {/* Live cost — pushed to the right */}
      <div className="ml-auto flex items-center gap-3 text-[11px] tabular-nums">
        <span className={adminTextMuted}>
          {cost.input_tokens.toLocaleString('fr-FR')} / {cost.output_tokens.toLocaleString('fr-FR')} tok
        </span>
        <span className={cn("font-semibold", adminText)}>{fmtEur(cost.cost_eur)}</span>
      </div>
    </div>
  );
}
