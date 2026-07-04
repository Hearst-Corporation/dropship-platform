import { Checkbox, CheckboxField } from '@/components/catalyst/checkbox';
import { Label } from '@/components/catalyst/fieldset';
import {
  adminBgInset,
  adminBgPanel,
  adminBorder,
  adminText,
  adminTextMuted,
} from '@/components/admin/admin-surface';
import { cn } from '@/lib/utils/cn';
import type { CostSummary } from './types';
import { fmtEur } from './utils';

interface CopilotSidebarProps {
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
        "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-indigo-500 text-white"
          : cn(adminTextMuted, "hover:text-zinc-100"),
      )}
    >
      {children}
    </button>
  );
}

export function CopilotSidebar({
  mode,
  onModeChange,
  language,
  onLanguageChange,
  skipVideo,
  onSkipVideoChange,
  cost,
}: CopilotSidebarProps) {
  return (
    <aside className={cn("px-4 py-4 space-y-4 overflow-y-auto text-xs border-l", adminBorder, adminBgPanel)}>
      {/* Sélecteurs rapides */}
      <div>
        <p className={cn("text-[10px] uppercase tracking-wide font-semibold mb-2", adminTextMuted)}>
          Format
        </p>
        <div className={cn("grid grid-cols-2 gap-1 rounded-lg p-1", adminBgInset)}>
          <SegmentedButton active={mode === 'mono'} onClick={() => onModeChange('mono')}>
            Mono
          </SegmentedButton>
          <SegmentedButton active={mode === 'collection'} onClick={() => onModeChange('collection')}>
            Collection
          </SegmentedButton>
        </div>
      </div>

      <div>
        <p className={cn("text-[10px] uppercase tracking-wide font-semibold mb-2", adminTextMuted)}>
          Langue
        </p>
        <div className={cn("grid grid-cols-2 gap-1 rounded-lg p-1", adminBgInset)}>
          <SegmentedButton active={language === 'fr'} onClick={() => onLanguageChange('fr')}>
            FR
          </SegmentedButton>
          <SegmentedButton active={language === 'en'} onClick={() => onLanguageChange('en')}>
            EN
          </SegmentedButton>
        </div>
      </div>

      {mode === 'mono' && (
        <CheckboxField>
          <Checkbox
            checked={!skipVideo}
            onChange={(checked) => onSkipVideoChange(!checked)}
          />
          <Label>Vidéo promo</Label>
        </CheckboxField>
      )}

      {/* Comment ça marche */}
      <div className={cn("pt-3 border-t", adminBorder)}>
        <p className={cn("text-[10px] uppercase tracking-wide font-semibold mb-2", adminTextMuted)}>
          Comment ça marche
        </p>
        <ul className={cn("text-[11px] space-y-1.5 leading-snug", adminTextMuted)}>
          <li><span className={cn("font-medium", adminText)}>Recherche web</span> · Tavily + Perplexity</li>
          <li><span className={cn("font-medium", adminText)}>Meta Ads</span> · saturation 0-100 + angles</li>
          <li><span className={cn("font-medium", adminText)}>AliExpress + CJ</span> · supply + marge</li>
        </ul>
      </div>

      {/* Coût session */}
      <div className={cn("pt-3 border-t", adminBorder)}>
        <p className={cn("text-[10px] uppercase tracking-wide font-semibold mb-2", adminTextMuted)}>
          Coût session
        </p>
        <div className="space-y-1 tabular-nums text-[11px]">
          <div className="flex justify-between">
            <span className={adminTextMuted}>Tokens i/o</span>
            <span className={adminText}>
              {cost.input_tokens.toLocaleString('fr-FR')} / {cost.output_tokens.toLocaleString('fr-FR')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className={adminTextMuted}>Estimation</span>
            <span className={cn("font-semibold", adminText)}>{fmtEur(cost.cost_eur)}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
