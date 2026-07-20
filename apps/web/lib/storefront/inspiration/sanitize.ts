/**
 * Sanitization obligatoire.
 *
 * `sanitizeExtractedPattern` transforme un ExtractedPattern (état brut, encore
 * potentiellement chargé de contenu source) en SanitizedPattern — le SEUL état
 * autorisé au stockage durable et à la génération de blueprints.
 *
 * Elle SUPPRIME : textes originaux, slogans, noms de marques/personnes, URLs
 * d'images, logos, classes CSS, snippets HTML, prix concurrents — bref tout
 * contenu reconnaissable. Elle GARDE : la signature structurelle (ordre des
 * sections, densité, placement CTA, stratégie image, comportement mobile).
 *
 * Principe : on part d'un objet VIDE et on ne recopie QUE les champs structurels
 * whitelistés. Le champ `raw` n'est jamais transféré. Impossible donc qu'un
 * champ sale « oublié » fuite : ce qui n'est pas explicitement recopié disparaît.
 */
import type { ExtractedPattern, SanitizedPattern } from './types';

/** Catégories de contenu que l'on retire, pour la preuve d'assainissement. */
const REMOVABLE_CATEGORIES = [
  'section_titles',
  'image_urls',
  'brand_names',
  'css_classes',
  'html_snippets',
  'prices',
  'slogans',
] as const;

/**
 * Retire d'un texte les TOKENS SOURCE connus (noms de marques, slogans, titres
 * de sections, classes CSS listés dans `raw`). Ce sont les seules chaînes dont
 * on sait avec certitude qu'elles viennent de la source ; on les efface donc
 * partout où elles pourraient avoir fuité (notes, signature, description).
 * Comparaison insensible à la casse, sur des sous-chaînes.
 */
export function redactKnownTokens(input: string, tokens: string[]): string {
  if (!input) return '';
  let s = input;
  // Du plus long au plus court pour éviter qu'un token court laisse un résidu.
  const sorted = [...new Set(tokens.filter((t) => t && t.trim().length >= 2))].sort(
    (a, b) => b.length - a.length,
  );
  for (const t of sorted) {
    const re = new RegExp(escapeRegExp(t), 'gi');
    s = s.replace(re, ' ');
  }
  return s;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Nettoie une chaîne libre (layoutSignature, visualRhythm, notes,
 * structuralDescription) de tout résidu reconnaissable : balises HTML, URLs,
 * classes CSS longues, prix. On NE veut garder qu'un vocabulaire structurel.
 */
export function scrubFreeText(input: string): string {
  if (!input) return '';
  let s = input;

  // Balises / snippets HTML → retirées.
  s = s.replace(/<\/?[a-z][^>]*>/gi, ' ');

  // URLs (http/https/protocole-relatif/www) → placeholder neutre.
  s = s.replace(/\b(?:https?:)?\/\/[^\s"'<>)]+/gi, '[url]');
  s = s.replace(/\bwww\.[^\s"'<>)]+/gi, '[url]');

  // Extensions de fichiers image → retirées (résidu d'asset).
  s = s.replace(/\b[\w-]+\.(?:png|jpe?g|webp|avif|gif|svg)\b/gi, '[img]');

  // Prix (symboles € $ £ + montant, ou montant + devise) → placeholder.
  s = s.replace(/(?:[€$£]\s?\d[\d.,]*)|(?:\d[\d.,]*\s?(?:€|\$|£|eur|usd|gbp))/gi, '[price]');

  // Sélecteurs CSS évidents (.class, #id, camel/kebab tailwind long) → retirés.
  s = s.replace(/[.#][a-z][\w-]{2,}/gi, ' ');

  // Compactage.
  return s.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Construit une description purement structurelle à partir des seuls champs
 * autorisés. Aucun texte source n'y entre — uniquement des énumérations de
 * types génériques et de réglages.
 */
export function buildStructuralDescription(p: ExtractedPattern): string {
  const order = p.sectionOrder.length ? p.sectionOrder.join(' → ') : p.patternType;
  return scrubFreeText(
    `${p.patternType} · ${order} · densité ${p.density} · CTA ${p.ctaPlacement} · ` +
      `image ${p.imageStrategy} · mobile ${p.mobileBehavior}`,
  );
}

/**
 * Assainit un pattern extrait. Retourne un SanitizedPattern garanti sans
 * contenu source, avec la trace des catégories retirées.
 */
export function sanitizeExtractedPattern(pattern: ExtractedPattern): SanitizedPattern {
  const raw = pattern.raw ?? {};

  // Quelles catégories étaient effectivement présentes (pour la preuve) ?
  const removed: string[] = [];
  if (raw.sectionTitles?.length) removed.push('section_titles');
  if (raw.imageUrls?.length) removed.push('image_urls');
  if (raw.brandNames?.length) removed.push('brand_names');
  if (raw.cssClasses?.length) removed.push('css_classes');
  if (raw.htmlSnippets?.length) removed.push('html_snippets');
  if (raw.prices?.length) removed.push('prices');
  if (raw.slogans?.length) removed.push('slogans');

  // Tokens source connus : on les efface de TOUT champ libre avant scrub. On
  // inclut le sourceId (souvent un hostname de marque) car le collector l'écrit
  // dans `notes` — c'est une provenance, pas un contenu à afficher.
  const knownTokens = [
    pattern.sourceId,
    ...(raw.brandNames ?? []),
    ...(raw.slogans ?? []),
    ...(raw.sectionTitles ?? []),
    ...(raw.cssClasses ?? []),
  ];
  const clean1 = (s: string) => scrubFreeText(redactKnownTokens(s, knownTokens));

  // Whitelist stricte : on ne recopie QUE la structure, jamais `raw`.
  const clean: SanitizedPattern = {
    id: pattern.id,
    sourceId: pattern.sourceId,
    patternType: pattern.patternType,
    layoutSignature: clean1(pattern.layoutSignature),
    sectionOrder: [...pattern.sectionOrder],
    density: pattern.density,
    visualRhythm: clean1(pattern.visualRhythm),
    ctaPlacement: pattern.ctaPlacement,
    imageStrategy: pattern.imageStrategy,
    mobileBehavior: pattern.mobileBehavior,
    ecommerceUsefulnessScore: pattern.ecommerceUsefulnessScore,
    structuralDescription: buildStructuralDescription(pattern),
    notes: clean1(pattern.notes),
    sanitization: { removed, rawStripped: true },
  };

  return clean;
}

/**
 * Audit défensif : vérifie qu'un objet quelconque présenté comme "sanitizé" ne
 * contient AUCUN résidu interdit. Utilisé par les tests et par l'UI admin pour
 * afficher « forbidden copied content: none ». Retourne la liste des violations
 * (vide = propre).
 */
export function auditSanitized(p: SanitizedPattern): string[] {
  const violations: string[] = [];

  // 1. Le champ brut ne doit jamais avoir survécu.
  if ('raw' in (p as unknown as Record<string, unknown>)) {
    violations.push('raw field present');
  }
  if (p.sanitization?.rawStripped !== true) {
    violations.push('rawStripped flag not set');
  }

  // 2. Aucune chaîne libre ne doit contenir de résidu reconnaissable.
  const freeTexts: Array<[string, string]> = [
    ['layoutSignature', p.layoutSignature],
    ['visualRhythm', p.visualRhythm],
    ['structuralDescription', p.structuralDescription],
    ['notes', p.notes],
  ];
  const forbidden: Array<[RegExp, string]> = [
    [/<\/?[a-z][^>]*>/i, 'html tag'],
    [/(?:https?:)?\/\/\S/i, 'url'],
    [/\bwww\.\S/i, 'url'],
    [/\.(?:png|jpe?g|webp|avif|gif|svg)\b/i, 'image asset'],
    [/[€$£]\s?\d/, 'price'],
    [/\d[\d.,]*\s?(?:€|\$|£|eur|usd|gbp)\b/i, 'price'],
  ];
  for (const [field, value] of freeTexts) {
    for (const [re, label] of forbidden) {
      if (re.test(value)) violations.push(`${field}: ${label}`);
    }
  }

  return violations;
}

export { REMOVABLE_CATEGORIES };
