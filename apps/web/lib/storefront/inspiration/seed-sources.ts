/**
 * Registry de sources d'inspiration — RÉFÉRENCES DE RECHERCHE UNIQUEMENT.
 *
 * Ce fichier ne contient AUCUN contenu protégé copié : ni HTML, ni CSS, ni
 * texte, ni image, ni logo, ni nom de marque tiers. Chaque entrée déclare
 * explicitement l'usage AUTORISÉ (extraction de pattern structurel) et l'usage
 * INTERDIT (images/textes/classes/assets). C'est un aide-mémoire de « où
 * chercher des structures », pas une bibliothèque de sites à cloner.
 *
 * Audité par seed-sources.test.ts : aucune entrée ne doit transporter de
 * contenu copié.
 */
import type { SourceType } from './types';

export interface SeedSource {
  sourceType: SourceType;
  /** Domaine racine public, à titre de repère de recherche seulement. */
  hint: string;
  allowedUse: string;
  forbiddenUse: string;
  /** Niches où cette source est typiquement pertinente. */
  niches: string[];
}

/**
 * Usage interdit commun à toutes les sources — factorisé pour qu'aucune entrée
 * ne puisse « oublier » la clause.
 */
const FORBIDDEN =
  'images, textes, slogans, classes CSS, snippets HTML, logos, noms de marques, icônes propriétaires, animations distinctives, assets externes';

export const SEED_SOURCES: readonly SeedSource[] = [
  {
    sourceType: 'tailwind_plus',
    hint: 'tailwindcss.com/plus',
    allowedUse: 'structure de section (hero split, feature grid, pricing shell) — layout pattern extraction only',
    forbiddenUse: FORBIDDEN,
    niches: ['tech-gadget', 'saas-adjacent-structure-only'],
  },
  {
    sourceType: 'dribbble',
    hint: 'dribbble.com (tag: ecommerce, product page)',
    allowedUse: 'rythme visuel, hiérarchie, composition — inspiration structurelle',
    forbiddenUse: FORBIDDEN,
    niches: ['beauty', 'fashion', 'gadget'],
  },
  {
    sourceType: 'awwwards',
    hint: 'awwwards.com (collections: e-commerce, shop)',
    allowedUse: 'ambition de mise en page, rythme éditorial premium — pattern extraction',
    forbiddenUse: FORBIDDEN + ', et notamment aucune animation signature reproduite',
    niches: ['fashion', 'luxury-structure-only'],
  },
  {
    sourceType: 'landbook',
    hint: 'land-book.com (category: ecommerce)',
    allowedUse: 'ordre des sections d’une landing DTC, densité — structure only',
    forbiddenUse: FORBIDDEN,
    niches: ['dtc-generic', 'home'],
  },
  {
    sourceType: 'shopify',
    hint: 'boutiques Shopify publiques (pages produit)',
    allowedUse: 'patterns d’offre, réassurance, FAQ, bundle — structure de conversion',
    forbiddenUse: FORBIDDEN + ', et aucun prix concurrent réutilisé',
    niches: ['pet-home', 'sport', 'gadget', 'beauty'],
  },
  {
    sourceType: 'manual_capture',
    hint: 'captures fournies par l’opérateur',
    allowedUse: 'description des sections observées → pattern structurel anonymisé',
    forbiddenUse: FORBIDDEN,
    niches: ['*'],
  },
];

/** Vérifie qu'une entrée ne transporte pas de contenu manifestement copié. */
export function seedSourceLooksClean(s: SeedSource): boolean {
  const blob = `${s.hint} ${s.allowedUse} ${s.forbiddenUse} ${s.niches.join(' ')}`;
  // Pas de balise HTML, pas de bloc de style, pas d'URL d'asset image.
  return !/[<>]|\{[^}]*:[^}]*\}|\.(png|jpe?g|webp|svg)\b/i.test(blob);
}
