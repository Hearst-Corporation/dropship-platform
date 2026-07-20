/**
 * Supplier product image ownership.
 *
 * Suppliers hand us a hotlink (`ae-pic-a1.aliexpress-media.com/...`). Storing
 * that URL in `dropship_store_products.image_url` makes the storefront depend
 * on a CDN we don't control: it can expire, rate-limit, or start refusing our
 * referer, and the product loses its main visual on a live store. AliExpress
 * also declares `imageRights: false` in its capability manifest.
 *
 * So we download the bytes server-side once, at creation time, and persist
 * them to the same backend the generated assets use — R2 in prod,
 * `public/generated/` in local dev — via `persistAsset()`. The supplier's
 * product page URL stays in `supplier_url`, untouched, for traceability.
 *
 * Fails soft by design: a dead supplier image must never abort store
 * creation. On any failure the caller keeps the original URL and surfaces a
 * warning, which is strictly better than the pre-existing behaviour.
 */
import { persistAsset } from './asset-generator';

/** Hard ceiling on a downloaded supplier image. Product shots are ~50-500 KB. */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;

export interface PersistSupplierImageArgs {
  /** Store slug — becomes the storage key prefix. */
  slug: string;
  /** Registry supplier id (`aliexpress`, `zendrop`, ...). */
  provider: string;
  /** Supplier-side product id, used to build a stable key. */
  externalId: string;
  /** The supplier hotlink to download. */
  imageUrl: string;
}

export interface PersistSupplierImageResult {
  /** URL to store in `image_url`: persisted on success, original on failure. */
  persistedUrl: string;
  /** The supplier URL we were handed, always echoed back. */
  originalUrl: string;
  /** Which backend actually holds the bytes. */
  storageProvider: 'r2' | 'local' | 'none';
  /** Human-readable reason when persistence didn't happen. */
  warning?: string;
}

/** Map a content-type / URL extension to the extension we store under. */
function extensionFor(contentType: string | null, url: string): string {
  const ct = (contentType ?? '').toLowerCase();
  if (ct.includes('png')) return 'png';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('avif')) return 'avif';
  if (ct.includes('gif')) return 'gif';
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
  const fromUrl = url.split('?')[0]?.match(/\.(png|webp|avif|gif|jpe?g)$/i)?.[1]?.toLowerCase();
  if (fromUrl) return fromUrl === 'jpeg' ? 'jpg' : fromUrl;
  return 'jpg';
}

/** Filesystem/R2-safe fragment (supplier ids and external ids are tame, but be strict). */
function safe(part: string): string {
  return part.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80);
}

/**
 * Download a supplier product image and persist it to R2 (or the local
 * fallback). Never throws — every failure path returns the original URL with
 * a warning so the caller can carry on and record it in the run report.
 */
export async function persistSupplierProductImage(
  args: PersistSupplierImageArgs,
): Promise<PersistSupplierImageResult> {
  const originalUrl = (args.imageUrl ?? '').trim();
  const base: Omit<PersistSupplierImageResult, 'warning'> = {
    persistedUrl: originalUrl,
    originalUrl,
    storageProvider: 'none',
  };

  if (!originalUrl) return { ...base, warning: 'URL image fournisseur vide' };
  // Already ours (re-run / backfill of an already-persisted row). Checked
  // before the http(s) guard: local URLs are web-rooted paths, not absolute.
  if (originalUrl.startsWith('/generated/')) {
    return { ...base, persistedUrl: originalUrl, storageProvider: 'local' };
  }
  if (!/^https?:\/\//i.test(originalUrl)) {
    return { ...base, warning: `URL image non http(s): ${originalUrl.slice(0, 60)}` };
  }

  try {
    const res = await fetch(originalUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: 'image/*,*/*' },
    });
    if (!res.ok) {
      return { ...base, warning: `HTTP ${res.status} sur l'image fournisseur` };
    }

    const contentType = res.headers.get('content-type');
    if (contentType && !contentType.toLowerCase().startsWith('image/')) {
      return { ...base, warning: `content-type inattendu: ${contentType.slice(0, 40)}` };
    }

    const declared = Number(res.headers.get('content-length') ?? '0');
    if (declared > MAX_IMAGE_BYTES) {
      return { ...base, warning: `image trop lourde (${declared} octets)` };
    }

    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.byteLength === 0) return { ...base, warning: 'image fournisseur vide (0 octet)' };
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      return { ...base, warning: `image trop lourde (${bytes.byteLength} octets)` };
    }

    const filename = `${safe(args.provider)}-${safe(args.externalId)}.${extensionFor(contentType, originalUrl)}`;
    // `persistAsset` picks R2 vs filesystem itself and returns the final URL.
    const persistedUrl = await persistAsset({
      storeSlug: args.slug,
      runDirName: 'products',
      filename,
      bytes,
    });

    return {
      persistedUrl,
      originalUrl,
      storageProvider: persistedUrl.startsWith('/generated/') ? 'local' : 'r2',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'erreur inconnue';
    return { ...base, warning: `téléchargement image échoué: ${msg.slice(0, 120)}` };
  }
}
