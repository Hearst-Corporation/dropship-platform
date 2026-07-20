import { getDbRead } from '@/lib/db';
import { getTemplateEntry } from '@/lib/template-catalog';

export interface ReadinessResult {
  score: number;
  blockers: string[];
  warnings: string[];
  nextActions: string[];
  canPublish: boolean;
}

interface StoreRow {
  id: string;
  name: string;
  niche: string;
  slug: string;
  mode: 'mono' | 'collection';
  template: string;
  hero_image_url: string | null;
  cutout_image_url: string | null;
  lifestyle_images: unknown;
  promo_video_url: string | null;
  medusa_sales_channel_id: string | null;
  medusa_publishable_key: string | null;
  landing_content: unknown;
  status: string;
  product_count: number;
  assets_status: string;
}

interface ProductRow {
  id: string;
  enriched_title: string;
  enriched_description: string;
  price_cents: number;
  cost_cents: number;
  image_url: string | null;
  medusa_product_id: string | null;
  supplier: string;
  external_id: string;
}

const MIN_SCORE = 0;

export interface ReadinessOptions {
  /**
   * True when this evaluation runs at the CLOSE of a creation run — the run
   * itself has just set the store to a transitory 'generating'/'validating'
   * status purely to compute readiness. In that context the transitory status
   * must NOT count as a blocker (it would always deduct 10 and force
   * needs_repair on an otherwise healthy store — a self-inflicted race). The
   * verdict is based on the REAL state (products, images, medusa, landing…).
   * Left false for admin-panel evaluations, where a store still 'generating'
   * legitimately surfaces "Génération encore en cours".
   */
  endOfRun?: boolean;
}

export async function evaluateStoreReadiness(
  storeId: string,
  options: ReadinessOptions = {},
): Promise<ReadinessResult> {
  const db = getDbRead();
  const storeRes = await db.query<StoreRow>(
    `SELECT id, name, niche, slug, mode, template, hero_image_url, cutout_image_url,
            lifestyle_images, promo_video_url, medusa_sales_channel_id, medusa_publishable_key,
            landing_content, status, product_count, assets_status
     FROM dropship_stores WHERE id = $1`,
    [storeId],
  );

  if (storeRes.rows.length === 0) {
    return {
      score: 0,
      blockers: ['Store introuvable'],
      warnings: [],
      nextActions: [],
      canPublish: false,
    };
  }

  const store = storeRes.rows[0];
  const productsRes = await db.query<ProductRow>(
    `SELECT id, enriched_title, enriched_description, price_cents, cost_cents, image_url,
            medusa_product_id, supplier, external_id
     FROM dropship_store_products WHERE store_id = $1`,
    [storeId],
  );
  const products = productsRes.rows;

  const blockers: string[] = [];
  const warnings: string[] = [];
  const nextActions: string[] = [];
  let score = 100;

  const deduct = (amount: number) => {
    score = Math.max(MIN_SCORE, score - amount);
  };

  // Identity
  if (!store.name?.trim()) { blockers.push('Nom manquant'); deduct(10); }
  if (!store.niche?.trim()) { blockers.push('Niche manquante'); deduct(10); }
  if (!store.slug?.trim()) { blockers.push('Slug manquant'); deduct(10); nextActions.push('Recréer le store avec un slug valide'); }

  // Template
  const templateEntry = getTemplateEntry(store.template);
  if (!store.template || store.template === 'auto') {
    warnings.push('Template non résolu (auto) — le renderer utilisera le fallback générique');
    deduct(5);
  } else if (!templateEntry) {
    blockers.push(`Template inconnu: ${store.template}`);
    deduct(10);
    nextActions.push('Choisir un template valide dans le catalogue');
  } else if (store.mode !== 'mono') {
    // `minProducts` is a collection-grid capacity hint: it only matters when
    // the storefront actually lays out several products. A mono store renders
    // MonoProductLanding (one hero SKU) regardless of the template's own mode,
    // so enforcing it there would permanently block a correctly-built mono
    // store from publishing. The "zéro produit" blocker below still applies.
    const minProducts = templateEntry.minProducts;
    if (products.length < minProducts) {
      blockers.push(`Le template ${store.template} requiert au moins ${minProducts} produits (${products.length} trouvé${products.length > 1 ? 's' : ''})`);
      deduct(20);
      nextActions.push(`Générer au moins ${minProducts - products.length} produit(s) supplémentaire(s)`);
    }
  }

  // Products
  if (products.length === 0) {
    blockers.push('Aucun produit');
    deduct(30);
    nextActions.push('Générer ou importer des produits');
  } else {
    const invalidProducts = products.filter(
      (p) =>
        !p.enriched_title?.trim() ||
        !p.enriched_description?.trim() ||
        !p.price_cents ||
        p.price_cents <= 0 ||
        (!p.image_url && !p.medusa_product_id),
    );
    if (invalidProducts.length > 0) {
      warnings.push(`${invalidProducts.length} produit${invalidProducts.length > 1 ? 's' : ''} incomplet${invalidProducts.length > 1 ? 's' : ''}`);
      deduct(5 * invalidProducts.length);
      nextActions.push('Réparer ou régénérer les fiches produits incomplètes');
    }
  }

  // Assets & hero
  if (store.mode === 'mono') {
    if (!store.hero_image_url) {
      blockers.push('Hero image manquante (obligatoire en mode mono)');
      deduct(20);
      nextActions.push('Régénérer les assets visuels (hero)');
    }
    if (!store.cutout_image_url) {
      warnings.push('Cutout image manquante (fallback produit utilisé)');
      deduct(5);
    }
    if (store.assets_status === 'error') {
      warnings.push('La dernière génération d\'assets a échoué');
      deduct(10);
      nextActions.push('Régénérer les assets depuis l\'admin');
    }
  } else {
    if (!store.hero_image_url) {
      warnings.push('Pas de hero image (fallback couleur/logo)');
      deduct(5);
      nextActions.push('Générer un hero de marque pour ce template');
    }
  }

  // Medusa
  if (!store.medusa_sales_channel_id || !store.medusa_publishable_key) {
    blockers.push('Canal de vente Medusa non configuré');
    deduct(20);
    nextActions.push('Reprovisionner le canal Medusa');
  }

  // Smart components / landing content
  const landing =
    store.landing_content && typeof store.landing_content === 'object'
      ? (store.landing_content as Record<string, unknown>)
      : null;

  const smartComponentKeys = [
    'hero',
    'selling_points',
    'showcase',
    'trust_promises',
    'final_cta',
  ];
  const detectedSmartComponents = smartComponentKeys.filter((k) => {
    const v = landing?.[k];
    if (Array.isArray(v)) return v.length > 0;
    if (v && typeof v === 'object') return Object.keys(v).length > 0;
    return false;
  });

  if (!landing) {
    warnings.push('Contenu de landing manquant (fallback générique)');
    deduct(5);
    nextActions.push('Générer le contenu de la landing page');
  } else if (detectedSmartComponents.length < 3) {
    warnings.push(`Smart components landing incomplets (${detectedSmartComponents.length}/5 blocs détectés)`);
    deduct(5);
    nextActions.push('Régénérer le contenu de la landing avec tous les blocs');
  }

  // Status sanity
  if (store.status === 'failed') {
    blockers.push('Le dernier run a échoué');
    deduct(10);
    nextActions.push('Consulter le diagnostic et relancer le run');
  }
  // The transitory generating/validating status is only a real blocker for
  // out-of-run evaluations (e.g. the admin panel inspecting a store mid-run).
  // At the CLOSE of a creation run the run has just set this status itself to
  // compute readiness, so counting it here would always force needs_repair on
  // a healthy store (self-inflicted race). Skip it in the end-of-run context.
  if (!options.endOfRun && (store.status === 'generating' || store.status === 'validating')) {
    blockers.push('Génération encore en cours');
    deduct(10);
  }

  const canPublish = blockers.length === 0;

  return {
    score,
    blockers,
    warnings,
    nextActions,
    canPublish,
  };
}

/** Return the list of smart components detected in the landing content. */
export function detectSmartComponents(landing: unknown): string[] {
  if (!landing || typeof landing !== 'object') return [];
  const keys = ['hero', 'selling_points', 'showcase', 'beach_moment', 'specs', 'trust_promises', 'included_items', 'final_cta'];
  return keys.filter((k) => {
    const v = (landing as Record<string, unknown>)[k];
    if (Array.isArray(v)) return v.length > 0;
    if (v && typeof v === 'object') return Object.keys(v).length > 0;
    return false;
  });
}
