/**
 * Generate the structured `landing_content` JSON for a freshly created
 * store. Called once by store-creator after products are enriched and
 * before the storefront is exposed. The output is stored on
 * `dropship_stores.landing_content` and consumed by MonoProductLanding /
 * CollectionEditorialLanding (and any future template) so the copy is
 * always anchored to the actual product, never to leftover demo copy.
 *
 * Cost: ~$0.01 per store (Haiku, single shot). Failure is non-fatal —
 * templates have generic fallbacks for every field.
 */

import { trackedMessage } from './anthropic';
import { extractJson } from './json';
import { isLuxuryTemplate } from '@/lib/template-catalog';
import {
  luxuryCopySystemPrompt,
  luxuryCopyUserPrompt,
  type LuxuryCopyOutput,
} from './luxury-prompts';

export interface LandingContent {
  hero?: {
    kicker?: string;
    headline_html?: string;
    lede?: string;
  };
  selling_points?: Array<{ title: string; body: string }>;
  showcase?: {
    kicker?: string;
    headline_html?: string;
    lede?: string;
  };
  beach_moment?: {
    kicker?: string;
    headline_html?: string;
  };
  specs?: Array<{ key: string; value: string }>;
  trust_promises?: Array<{ title: string; body: string }>;
  included_items?: Array<{ qty: string; label: string }>;
  final_cta?: {
    kicker?: string;
    headline_html?: string;
    lede?: string;
  };
  /** Maison voice copy emitted by the luxury writer. Templates with
   *  `register: 'luxury'` (luxury-mono, fiora-locks-wh1270, etc.) read from
   *  this slot to override their hardcoded French placeholders. */
  luxury_copy?: LuxuryCopyOutput;
}

export interface LandingWriterInput {
  storeName: string;
  niche: string;
  tagline: string;
  storeDescription: string;
  productTitle: string;
  productDescription: string;
  /** Mode: mono (one hero SKU) or collection (3-6 pieces). */
  mode: 'mono' | 'collection';
  /** Storefront template id. When the template's register is `luxury`, the
   *  writer switches to the literary maison voice (Hermès / Aesop / Le Labo)
   *  and writes the copy into `landing_content.luxury_copy` for templates
   *  like `luxury-mono` to consume. */
  template?: string;
  /** Hex accent color of the brand. Threaded into luxury prompts to hint at
   *  the backdrop tint when relevant. */
  accentColor?: string;
  /** Supplier cost in cents — when present, the luxury writer uses it to
   *  frame the price as fair compensation for craft and time (×17 default).
   */
  supplierCostCents?: number;
}

const FALLBACK: LandingContent = {
  trust_promises: [
    {
      title: 'Expédition 24 h',
      body: 'Commande validée avant 16 h, votre colis part le jour même.',
    },
    {
      title: 'Livraison soignée',
      body: 'Emballage protégé, suivi temps réel par email, 3 à 7 jours ouvrés en France.',
    },
    {
      title: 'Essai 30 jours',
      body: 'Vous testez chez vous. Si ça ne convient pas, on reprend et on rembourse sans question.',
    },
  ],
};

/**
 * Build the landing content for a store. Returns FALLBACK on any error
 * so the storefront still renders, just with generic strings instead of
 * tailored copy.
 */
export async function writeLandingContent(
  input: LandingWriterInput,
): Promise<LandingContent> {
  if (!process.env.OPENAI_API_KEY) return FALLBACK;

  // Luxury path: when the template is in the luxury register, we run a
  // SECOND Claude call with the maison voice prompt and stash the output
  // under `landing_content.luxury_copy`. Templates like `luxury-mono` read
  // from there to override their placeholders. The standard DTC copy still
  // runs so other templates have something to render if the operator flips.
  const wantsLuxury = isLuxuryTemplate(input.template);

  let standard: LandingContent;
  try {
    const res = await trackedMessage(
      { step: 'landing-content' },
      {
        model: 'gpt-4o-mini',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: buildPrompt(input),
          },
        ],
      },
    );
    const text = res.content[0]?.type === 'text' ? res.content[0].text : '';
    const parsed = extractJson<LandingContent>(text);
    standard = parsed ? sanitizeLandingContent({ ...FALLBACK, ...parsed }) : FALLBACK;
  } catch (err) {
    console.warn('[landing-writer] generation failed, using fallback', err);
    standard = FALLBACK;
  }

  if (!wantsLuxury) return standard;

  try {
    const priceEuros = input.supplierCostCents
      ? Math.round((input.supplierCostCents / 100) * 17)
      : undefined;
    const res = await trackedMessage(
      { step: 'landing-content-luxury' },
      {
        model: 'gpt-4o',
        max_tokens: 1500,
        // Timelessness guard appended here (single-owner file): the shared
        // luxury system prompt lives in luxury-prompts.ts, but the "no year"
        // constraint is a landing-writer concern — a hardcoded "2023"/"2024"
        // in the copy dates the storefront instantly.
        system: `${luxuryCopySystemPrompt()} Never mention any year, date or vintage ("2023", "2024", "depuis 2025", ...) anywhere in the copy — it must read timeless.`,
        messages: [
          {
            role: 'user',
            content: luxuryCopyUserPrompt({
              storeName: input.storeName,
              productName: input.productTitle,
              niche: input.niche,
              accentColor: input.accentColor ?? '#7a5c3a',
              positioning: input.tagline,
              supplierDescription: input.productDescription,
              priceEuros,
            }),
          },
        ],
      },
    );
    const text = res.content[0]?.type === 'text' ? res.content[0].text : '';
    const luxe = extractJson<LuxuryCopyOutput>(text);
    if (!luxe) return standard;
    return sanitizeLandingContent({
      ...standard,
      luxury_copy: luxe,
      // Mirror atelier_pillars into selling_points so templates that read
      // the generic `selling_points` slot also benefit from the luxury voice.
      selling_points: luxe.atelier_pillars?.length
        ? luxe.atelier_pillars.map((p) => ({ title: p.title, body: p.body }))
        : standard.selling_points,
    });
  } catch (err) {
    console.warn('[landing-writer] luxury copy failed, falling back to standard', err);
    return standard;
  }
}

// ── year sanitisation ────────────────────────────────────────────────────
//
// The prompt forbids years, but LLMs still leak stale ones ("NOUVEAU · 2023"
// was observed in QA). This deterministic post-parse pass guarantees the
// stored landing_content is timeless regardless of what the model returned.

/** Standalone 19xx/20xx year, but never digits belonging to a numeric HTML
 *  entity (`&#2024;`) — the `(?<!&#)` guard keeps legitimate entities intact. */
const YEAR_RE = /(?<!&#)\b(?:19|20)\d{2}\b/;

/**
 * Remove standalone 19xx/20xx years from a piece of copy and tidy up what
 * they leave behind (orphan separators, dangling prepositions, double
 * spaces, empty <em></em>). Pure and idempotent; returns the input
 * untouched when it contains no year.
 *
 *   "NOUVEAU · 2023"              → "NOUVEAU"
 *   "Depuis 2024, la précision"   → "La précision"
 *   "Pensé pour 2025 et après"    → "Pensé et après"
 *   "Édition &#2024; limitée"     → unchanged (HTML entity)
 */
export function stripYears(text: string): string {
  if (!text || !YEAR_RE.test(text)) return text;

  let out = text
    // Preposition + year phrases: drop the whole phrase so we never leave a
    // dangling "depuis"/"en"/"pour" behind.
    .replace(/\b(?:depuis|dès|en|pour|de|d'|since|in)\s*(?:19|20)\d{2}\b/gi, '')
    // Remaining standalone years.
    .replace(new RegExp(YEAR_RE.source, 'g'), '')
    // Emphasis tags left empty by a removed year.
    .replace(/<(em|strong|b|i)>\s*<\/\1>/gi, '');

  // Orphan separators: collapse doubled ones, drop leading/trailing ones.
  // Mid-string separators between two surviving segments ("Nouveau · Édition")
  // are legitimate and kept.
  out = out
    .replace(/\s*[·|,;:/–—-]\s*(?=[·|,;:/–—-])/g, ' ')
    .replace(/^\s*[·|,;:/–—-]\s*/, '')
    .replace(/\s*[·|,;:/–—-]\s*$/, '')
    .replace(/\s+([,;:.!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // If the removal beheaded the sentence ("Depuis 2024, la…" → "la…"),
  // restore the leading capital the original had.
  if (/^[a-zà-öø-ÿ]/.test(out) && /^[^a-zà-öø-ÿ]/.test(text.trim())) {
    out = out.charAt(0).toUpperCase() + out.slice(1);
  }
  return out;
}

type HeroBlock = { kicker?: string; headline_html?: string; lede?: string };

function stripBlock<T extends HeroBlock | undefined>(block: T): T {
  if (!block) return block;
  const out: HeroBlock = { ...block };
  if (out.kicker !== undefined) out.kicker = stripYears(out.kicker);
  if (out.headline_html !== undefined) out.headline_html = stripYears(out.headline_html);
  if (out.lede !== undefined) out.lede = stripYears(out.lede);
  return out as T;
}

function stripPairs<T extends Array<{ title: string; body: string }> | undefined>(
  items: T,
): T {
  if (!items) return items;
  return items.map((p) => ({
    ...p,
    title: stripYears(p.title),
    body: stripYears(p.body),
  })) as T;
}

/**
 * Apply {@link stripYears} to every user-visible text field of a parsed
 * LandingContent (hero/showcase/beach_moment/final_cta blocks, selling
 * points, trust promises, and the luxury copy when present). Pure — returns
 * a new object, never mutates the input.
 */
export function sanitizeLandingContent(content: LandingContent): LandingContent {
  const out: LandingContent = {
    ...content,
    hero: stripBlock(content.hero),
    showcase: stripBlock(content.showcase),
    beach_moment: stripBlock(content.beach_moment),
    final_cta: stripBlock(content.final_cta),
    selling_points: stripPairs(content.selling_points),
    trust_promises: stripPairs(content.trust_promises),
  };

  if (content.luxury_copy) {
    const lux = content.luxury_copy;
    out.luxury_copy = {
      ...lux,
      hero_eyebrow: stripYears(lux.hero_eyebrow),
      hero_lede: stripYears(lux.hero_lede),
      story_headline: stripYears(lux.story_headline),
      story_body: lux.story_body?.map((s) => stripYears(s)) as [string, string],
      atelier_pillars: stripPairs(lux.atelier_pillars),
      price_rationale: stripYears(lux.price_rationale),
      packaging_headline: stripYears(lux.packaging_headline),
      packaging_body: stripYears(lux.packaging_body),
      final_cta_note: stripYears(lux.final_cta_note),
    };
  }

  return out;
}

function buildPrompt(i: LandingWriterInput): string {
  return `Tu écris la copie d'une landing page DTC en français pour un store dropshipping. Le store vient d'être créé, ton job : produire un bloc JSON structuré qui sera rendu directement par le template (mono-produit ou collection).

CONTRAINTES NON NÉGOCIABLES :
- Toute la copie doit être SPÉCIFIQUE au produit ci-dessous. Aucune mention de ventilateurs, climatiseurs, masques LED, veilleuses, ou tout autre produit que tu connaîtrais par ailleurs si ce n'est PAS celui-ci.
- Français concret, pas de em-dash, pas de triade rythmée. Chiffres et faits là où c'est possible.
- Tutoiement neutre. Pas d'emojis.
- INTERDIT ABSOLU : aucune année, aucune date, aucun millésime ("2023", "2024", "depuis 2025", "édition 2026"...) nulle part — ni dans le kicker, ni dans les headlines, ni dans les ledes, ni dans les sections. La copie doit être intemporelle.
- "headline_html" peut contenir UN <em>...</em> pour souligner un mot clé, rien d'autre.

CONTEXTE STORE :
- Nom : ${i.storeName}
- Niche : ${i.niche}
- Tagline : ${i.tagline || '(vide)'}
- Description : ${i.storeDescription || '(vide)'}
- Mode : ${i.mode}

PRODUIT HÉRO :
- Titre : ${i.productTitle}
- Description : ${i.productDescription.slice(0, 800)}

Retourne UNIQUEMENT ce JSON, sans préambule :
{
  "hero": {
    "kicker": "Mini badge en haut, 1-3 mots (ex: 'Nouveau', 'Édition atelier') — jamais d'année ni de date",
    "headline_html": "Phrase d'accroche courte (8-14 mots), UN <em></em> sur le mot fort",
    "lede": "1-2 phrases factuelles qui décrivent l'usage et le bénéfice principal"
  },
  "selling_points": [
    { "title": "3-5 mots", "body": "1-2 phrases concrètes, un chiffre ou une caractéristique précise" },
    { "title": "3-5 mots", "body": "..." },
    { "title": "3-5 mots", "body": "..." }
  ],
  "showcase": {
    "kicker": "L'objet / Le produit / similaire",
    "headline_html": "Phrase courte, UN <em></em>",
    "lede": "1 phrase sensorielle"
  },
  "beach_moment": {
    "kicker": "2 mots sur le moment d'usage",
    "headline_html": "Phrase évocatrice courte"
  },
  "specs": [
    { "key": "Caractéristique", "value": "valeur" }
  ],
  "included_items": [
    { "qty": "01", "label": "${i.productTitle.slice(0, 40)}" },
    { "qty": "·", "label": "Emballage protégé" },
    { "qty": "·", "label": "Notice d'utilisation" },
    { "qty": "·", "label": "Suivi de livraison" }
  ],
  "final_cta": {
    "kicker": "Prêt ?",
    "headline_html": "Phrase d'engagement courte, UN <em></em>",
    "lede": "1 phrase sur la livraison + l'essai 30 jours"
  }
}

Si tu n'as pas assez d'information pour remplir un champ (par ex. specs précises), retourne un tableau vide [] pour ce champ — le template a un fallback générique.`;
}
