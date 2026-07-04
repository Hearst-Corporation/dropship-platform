import type { StoreTemplate } from '@/lib/template-catalog';
import type {
  DesignProposal as ResearchDesignProposal,
  FeaturedProduct as ResearchFeaturedProduct,
  ShortlistPayload as ResearchShortlistPayload,
} from '@/lib/agent/research/types';

export interface SessionSummary {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
  preview: string | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_name: string | null;
  tool_input: unknown;
  tool_output: unknown;
  is_error?: boolean;
  streaming?: boolean;
  // Pinned shortlist info — when tool_name === 'shortlist_niche', the UI
  // renders a CTA card that pre-fills the form below.
  shortlist?: ShortlistPayload;
}

// Re-exported (type-only) from the research copilot's own types
// (lib/agent/research/types.ts) — that module is the live source of truth
// for the shortlist_niche tool output shape. Importing instead of
// redefining keeps this UI from drifting out of sync with the agent side,
// which is exactly what happened upstream when DesignProposal's preset
// union grew from 5 to 25 slugs after these files were first written.
export type FeaturedProduct = ResearchFeaturedProduct;
export type DesignProposal = ResearchDesignProposal;

export interface MediaChannel {
  name: 'meta' | 'tiktok' | 'google' | 'pinterest';
  weight_pct: number;
  expected_cpm_eur?: number;
  expected_cpc_eur?: number;
  expected_cpa_eur?: number;
  rationale?: string;
}

export interface MediaPlan {
  daily_budget_eur: number;
  channels: MediaChannel[];
  geo: {
    primary_countries: string[];
    emphasis?: string[];
    rationale?: string;
  };
  audience: {
    demographics: string;
    interests: string[];
    lookalike_seeds?: string[];
  };
  schedule: {
    best_hours_local: string[];
    best_days: string[];
    timezone?: string;
    rationale?: string;
  };
  expected_outcomes: {
    daily_orders_low: number;
    daily_orders_high: number;
    target_cpa_eur: number;
    target_roas: number;
    breakeven_note?: string;
  };
  top_hooks?: string[];
}

// `suggested_template` on the canonical ShortlistPayload (research/types.ts)
// is typed as `string` there — that module can't import the StoreTemplate
// union without creating a cycle through research/tools.ts. Narrow it back
// to StoreTemplate here for this UI's convenience: this is a type-level
// refinement only, the runtime value always comes from the zod-validated
// `suggested_template` enum in research/tools.ts (ShortlistNicheInput), so
// it's guaranteed to be a valid StoreTemplate id whenever it's set.
export type ShortlistPayload = Omit<ResearchShortlistPayload, 'suggested_template'> & {
  suggested_template?: StoreTemplate;
};

export interface CostSummary {
  input_tokens: number;
  output_tokens: number;
  cost_eur: number;
}

export interface CreationProgress {
  running: boolean;
  percent: number;
  elapsed: number;
  currentStep: string;
  storeName: string;
  logs: { id: number; type: string; message: string; ts: string }[];
  result: { slug: string; storeName: string; productCount: number } | null;
  error: string | null;
}
