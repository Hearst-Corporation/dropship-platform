import type { AssetKind } from "@/lib/agent/asset-regenerator";

/**
 * UI labels for each asset kind. Kept in a NEUTRAL module (no "use client",
 * no server imports) so it can be imported by BOTH the Server Component page
 * and the client AssetRegenerator. Importing a plain value from a "use client"
 * module into a Server Component resolves to a client reference (undefined at
 * render), which crashed StoreAssetsPage on `ASSET_KIND_LABELS[kind].title`.
 */
export const ASSET_KIND_LABELS: Record<AssetKind, { title: string; hint: string }> = {
  hero: {
    title: "Hero",
    hint: "Plein cadre éditorial 16:9 servi en haut du storefront.",
  },
  cutout: {
    title: "Cutout",
    hint: "Produit centré sur fond studio sombre. Sert aussi de source à la vidéo promo.",
  },
  "lifestyle-1": {
    title: "Lifestyle 1",
    hint: "Premier moment de vie : contexte intérieur lumineux.",
  },
  "lifestyle-2": {
    title: "Lifestyle 2",
    hint: "Deuxième moment de vie : contexte extérieur ou alternatif.",
  },
  "lifestyle-3": {
    title: "Lifestyle 3",
    hint: "Troisième moment de vie : usage situé, distinct des deux précédents.",
  },
  promo: {
    title: "Vidéo promo",
    hint: "5 secondes 9:16, image-to-video à partir du cutout.",
  },
};
