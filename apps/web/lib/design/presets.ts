/**
 * Curated design presets for storefronts. The agent picks 3 candidates per
 * niche, the user confirms one in the chat, and the choice is FROZEN in
 * `dropship_stores.design_preset`. No more random Google Fonts on every
 * regeneration — same store, same fonts, same mood.
 *
 * Each preset bundles:
 *   - A font pair (display + body) loaded from Google Fonts at runtime
 *   - A palette skeleton (the agent fills in primary/accent per-store)
 *   - A "mood" string used by the FLUX prompt builder so generated imagery
 *     visually matches the type system
 *
 * Keep this list short and opinionated. Five well-tuned presets beat fifty
 * mediocre ones, and the agent can recommend confidently.
 */

export interface PaletteSkeleton {
  /** Backgrounds — the body and elevated surfaces. */
  bg: string;
  surface: string;
  /** Text colors. */
  text: string;
  textMuted: string;
  /** Lines + dividers. */
  border: string;
}

export interface DesignPreset {
  slug: string;
  label: string;
  /** One-sentence pitch shown to the user when they choose. */
  tagline: string;
  /** Best suited for these niches (used by the agent for shortlisting). */
  suitedFor: string[];
  fonts: {
    display: { family: string; weights: number[]; italic?: boolean };
    body: { family: string; weights: number[]; italic?: boolean };
  };
  /** Default neutrals — primary + accent come from the per-store palette. */
  neutrals: PaletteSkeleton;
  /** One-line mood the FLUX prompt builder pastes into asset prompts. */
  imageryMood: string;
  /** UI rendering hints. */
  ui: {
    radius: 'sharp' | 'soft' | 'pill';
    contrast: 'low' | 'medium' | 'high';
    headingTracking: number;
  };
}

export const DESIGN_PRESETS: DesignPreset[] = [
  {
    slug: 'editorial-serif',
    label: 'Editorial serif',
    tagline: 'Magazine de mode. Italiques cinéma, blancs généreux, ton premium discret.',
    suitedFor: ['lifestyle', 'beauty', 'home', 'fashion', 'wellness'],
    fonts: {
      display: { family: 'Instrument Serif', weights: [400], italic: true },
      body: { family: 'Inter Tight', weights: [400, 500, 600] },
    },
    neutrals: {
      bg: '#faf8f3',
      surface: '#ffffff',
      text: '#0d0d0d',
      textMuted: '#6b6b6b',
      border: '#e6e2d8',
    },
    imageryMood: 'editorial 35mm photograph, soft north-window light, warm neutrals, sand and bone tones, deep negative space, magazine cover quality',
    ui: { radius: 'soft', contrast: 'medium', headingTracking: -0.02 },
  },
  {
    slug: 'tech-mono',
    label: 'Tech mono',
    tagline: 'Vercel-grade. Geist + lettres précises. Pour produits techniques et minimalistes.',
    suitedFor: ['tech', 'gadgets', 'productivity', 'office', 'audio'],
    fonts: {
      display: { family: 'Geist', weights: [500, 600, 800] },
      body: { family: 'Geist', weights: [400, 500] },
    },
    neutrals: {
      bg: '#0a0a0a',
      surface: '#121212',
      text: '#fafafa',
      textMuted: '#a3a3a3',
      border: '#262626',
    },
    imageryMood: 'studio product photograph on matte black surface, cold neutral light, single rim light, brushed aluminum textures, controlled shadow, technical precision',
    ui: { radius: 'sharp', contrast: 'high', headingTracking: -0.025 },
  },
  {
    slug: 'brutalist-luxe',
    label: 'Brutalist luxe',
    tagline: 'Off-White rencontre Jacquemus. Lettres pleines, blocs noirs, contraste maximal.',
    suitedFor: ['fashion', 'streetwear', 'accessories', 'luxury'],
    fonts: {
      display: { family: 'PP Editorial New', weights: [400, 700], italic: true },
      body: { family: 'Satoshi', weights: [400, 500, 700, 900] },
    },
    neutrals: {
      bg: '#f4f1ec',
      surface: '#ffffff',
      text: '#000000',
      textMuted: '#525252',
      border: '#000000',
    },
    imageryMood: 'high-contrast editorial photograph, hard sunlight or seamless studio, sharp shadow, single stark color background, fashion campaign mood, no fuss',
    ui: { radius: 'sharp', contrast: 'high', headingTracking: -0.04 },
  },
  {
    slug: 'gen-z-bold',
    label: 'Gen-Z bold',
    tagline: 'Saturé, énergique, vibe TikTok. Display Migra + body General Sans, grain léger.',
    suitedFor: ['fitness', 'fashion', 'beauty', 'tech', 'snacks', 'pets'],
    fonts: {
      display: { family: 'Migra', weights: [600, 900], italic: true },
      body: { family: 'General Sans', weights: [400, 500, 600] },
    },
    neutrals: {
      bg: '#fff8ec',
      surface: '#ffffff',
      text: '#101010',
      textMuted: '#4a4a4a',
      border: '#101010',
    },
    imageryMood: 'vibrant editorial photograph, saturated golden hour light, real young person using the product, candid energy, grain, color-blocked composition',
    ui: { radius: 'pill', contrast: 'high', headingTracking: -0.035 },
  },
  {
    slug: 'lifestyle-warm',
    label: 'Lifestyle warm',
    tagline: 'Aimé Leon Dore. Tons sable et terracotta, serif chaud, dimanche matin DTC.',
    suitedFor: ['lifestyle', 'home', 'kitchen', 'beauty', 'wellness', 'pets'],
    fonts: {
      display: { family: 'Fraunces', weights: [400, 600], italic: true },
      body: { family: 'Inter Tight', weights: [400, 500, 600] },
    },
    neutrals: {
      bg: '#f3ede2',
      surface: '#fbf8f1',
      text: '#1c1611',
      textMuted: '#6b5e4f',
      border: '#d9cfbd',
    },
    imageryMood: 'warm Sunday-morning photograph, oak and linen textures, terracotta and bone palette, soft golden window light, human hands in frame, slow-living mood',
    ui: { radius: 'soft', contrast: 'medium', headingTracking: -0.02 },
  },
  // ---------------------------------------------------------------------
  // Niche-matched presets
  // ---------------------------------------------------------------------
  {
    slug: 'gadget-graphite',
    label: 'Gadget graphite',
    tagline: "Labo produit. Graphite froid, néon cyan, précision d'ingénieur.",
    suitedFor: ['tech'],
    fonts: {
      display: { family: 'Space Grotesk', weights: [500, 700] },
      body: { family: 'Inter', weights: [400, 500, 600] },
    },
    neutrals: {
      bg: '#0e1116',
      surface: '#171b22',
      text: '#f2f4f7',
      textMuted: '#9aa4b2',
      border: '#2a303a',
    },
    imageryMood: 'studio product shot on graphite surface, cold cyan rim light, macro detail on ports and seams, engineered precision, dark backdrop',
    ui: { radius: 'sharp', contrast: 'high', headingTracking: -0.02 },
  },
  {
    slug: 'pet-playful',
    label: 'Pet playful',
    tagline: 'Copain à quatre pattes. Rondeurs, corail doux, joie du dimanche.',
    suitedFor: ['pet'],
    fonts: {
      display: { family: 'Baloo 2', weights: [600, 700] },
      body: { family: 'Nunito Sans', weights: [400, 600, 700] },
    },
    neutrals: {
      bg: '#fff9f2',
      surface: '#ffffff',
      text: '#2b241d',
      textMuted: '#7a6b5c',
      border: '#eaddce',
    },
    imageryMood: 'bright lifestyle photo of a happy pet, soft natural window light, warm cream tones, shallow depth of field, joyful candid moment',
    ui: { radius: 'pill', contrast: 'medium', headingTracking: -0.01 },
  },
  {
    slug: 'gourmet-noir',
    label: 'Gourmet noir',
    tagline: 'Table de chef. Fond noir, ambre doré, gourmandise premium.',
    suitedFor: ['food', 'beverage'],
    fonts: {
      display: { family: 'Playfair Display', weights: [500, 700] },
      body: { family: 'Karla', weights: [400, 500, 600] },
    },
    neutrals: {
      bg: '#12100d',
      surface: '#1c1813',
      text: '#f6efe4',
      textMuted: '#b6a992',
      border: '#33291f',
    },
    imageryMood: 'dark moody food photography, single warm side light, glistening textures, deep shadows, restaurant menu quality, amber highlights',
    ui: { radius: 'soft', contrast: 'high', headingTracking: -0.015 },
  },
  {
    slug: 'home-linen',
    label: 'Home linen',
    tagline: "Intérieur soigné. Lin, sauge, lumière tamisée de fin d'après-midi.",
    suitedFor: ['home'],
    fonts: {
      display: { family: 'Cormorant Garamond', weights: [500, 600] },
      body: { family: 'Work Sans', weights: [400, 500] },
    },
    neutrals: {
      bg: '#f5f2ec',
      surface: '#fbfaf6',
      text: '#26241f',
      textMuted: '#7c766a',
      border: '#e0dacd',
    },
    imageryMood: 'interior styling photo, soft diffused daylight, linen and oak textures, muted sage and clay palette, calm composed negative space',
    ui: { radius: 'soft', contrast: 'low', headingTracking: -0.015 },
  },
  {
    slug: 'kids-crayon',
    label: 'Kids crayon',
    tagline: "Chambre d'enfant. Pastels doux, jaune tendre, tendresse.",
    suitedFor: ['kids'],
    fonts: {
      display: { family: 'Fredoka', weights: [500, 600] },
      body: { family: 'Quicksand', weights: [400, 500, 600] },
    },
    neutrals: {
      bg: '#fefcf7',
      surface: '#ffffff',
      text: '#33302b',
      textMuted: '#857f74',
      border: '#efe9db',
    },
    imageryMood: 'soft pastel product photo, gentle diffused light, playful rounded props, cream background, tender warm palette, safe cozy mood',
    ui: { radius: 'pill', contrast: 'low', headingTracking: 0 },
  },
  {
    slug: 'jewel-mono',
    label: 'Jewel mono',
    tagline: 'Écrin noir. Or brossé, italique fin, luxe silencieux.',
    suitedFor: ['jewelry'],
    fonts: {
      display: { family: 'Cormorant', weights: [400, 500], italic: true },
      body: { family: 'Jost', weights: [300, 400, 500] },
    },
    neutrals: {
      bg: '#0b0a09',
      surface: '#131110',
      text: '#f4f1ea',
      textMuted: '#a89f8f',
      border: '#2a2622',
    },
    imageryMood: 'macro jewelry photograph on black velvet, single focused spotlight, brushed gold reflections, deep blacks, intimate luxury, mono-product hero',
    ui: { radius: 'sharp', contrast: 'high', headingTracking: -0.01 },
  },
  {
    slug: 'trail-forge',
    label: 'Trail forge',
    tagline: 'Grand air. Vert forêt, orange sécurité, robuste et prêt.',
    suitedFor: ['sport'],
    fonts: {
      display: { family: 'Oswald', weights: [500, 600] },
      body: { family: 'Barlow', weights: [400, 500, 600] },
    },
    neutrals: {
      bg: '#14170f',
      surface: '#1d211a',
      text: '#eef0e6',
      textMuted: '#9ba393',
      border: '#2e3527',
    },
    imageryMood: 'outdoor adventure photo, overcast mountain light, weathered gear on rock and moss, forest green and rust palette, rugged authentic',
    ui: { radius: 'sharp', contrast: 'high', headingTracking: 0 },
  },
  {
    slug: 'auto-carbon',
    label: 'Auto carbon',
    tagline: 'Garage haut de gamme. Carbone, rouge course, lignes tendues.',
    // NOTE: 'automotive' is not (yet) a TemplateNiche in lib/template-catalog.ts.
    // Kept here as plain data for future wiring — out of scope for this change.
    suitedFor: ['automotive'],
    fonts: {
      display: { family: 'Rajdhani', weights: [600, 700] },
      body: { family: 'Titillium Web', weights: [400, 600] },
    },
    neutrals: {
      bg: '#0c0d0f',
      surface: '#15171a',
      text: '#f0f2f4',
      textMuted: '#8b939c',
      border: '#24272c',
    },
    imageryMood: 'automotive detail photo on carbon fiber, hard directional garage light, chrome and matte black, racing red accent, sharp reflective surfaces',
    ui: { radius: 'sharp', contrast: 'high', headingTracking: -0.02 },
  },
  {
    slug: 'urban-concrete',
    label: 'Urban concrete',
    tagline: 'Bitume. Béton noir, vert acide, énergie de rue.',
    suitedFor: ['fashion'],
    fonts: {
      display: { family: 'Archivo Expanded', weights: [700, 800] },
      body: { family: 'Archivo', weights: [400, 500, 600] },
    },
    neutrals: {
      bg: '#141414',
      surface: '#1e1e1e',
      text: '#fafafa',
      textMuted: '#8f8f8f',
      border: '#333333',
    },
    imageryMood: 'street style flash photograph, harsh direct flash on concrete, night city grit, acid green accent, urban texture, hype drop mood',
    ui: { radius: 'sharp', contrast: 'high', headingTracking: -0.03 },
  },
  {
    slug: 'gift-ribbon',
    label: 'Gift ribbon',
    tagline: "Coffret d'exception. Prune tendre, ruban doré, attention offerte.",
    suitedFor: ['gifting'],
    fonts: {
      display: { family: 'Marcellus', weights: [400] },
      body: { family: 'Mulish', weights: [400, 500, 600] },
    },
    neutrals: {
      bg: '#f7f2f4',
      surface: '#ffffff',
      text: '#2a1f26',
      textMuted: '#7d6a74',
      border: '#e8dce1',
    },
    imageryMood: 'elegant gift styling photo, soft flattering light, ribbon and tissue textures, plum and gold palette, refined giftable presentation',
    ui: { radius: 'soft', contrast: 'medium', headingTracking: -0.01 },
  },
  // ---------------------------------------------------------------------
  // General-purpose presets
  // ---------------------------------------------------------------------
  {
    slug: 'scandi-minimal',
    label: 'Scandi minimal',
    tagline: 'Épure nordique. Blanc laiteux, sauge discrète, calme absolu.',
    suitedFor: [],
    fonts: {
      display: { family: 'Manrope', weights: [600, 700] },
      body: { family: 'Manrope', weights: [400, 500] },
    },
    neutrals: {
      bg: '#fbfbfa',
      surface: '#ffffff',
      text: '#1a1a1a',
      textMuted: '#767676',
      border: '#e8e8e6',
    },
    imageryMood: 'minimalist scandinavian interior photo, flat soft daylight, pale wood and white, generous emptiness, quiet muted palette',
    ui: { radius: 'soft', contrast: 'low', headingTracking: -0.015 },
  },
  {
    slug: 'art-deco-glam',
    label: 'Art deco glam',
    tagline: 'Gatsby doré. Nuit violine, or et vert émeraude, glamour 1920.',
    suitedFor: [],
    fonts: {
      display: { family: 'Poiret One', weights: [400] },
      body: { family: 'Josefin Sans', weights: [400, 500, 600] },
    },
    neutrals: {
      bg: '#0f0e14',
      surface: '#1a1824',
      text: '#f3eee1',
      textMuted: '#b0a68f',
      border: '#2f2a3d',
    },
    imageryMood: 'art deco styled photo, dramatic golden spotlight, geometric symmetry, emerald and gold, velvet and brass, opulent 1920s glamour',
    ui: { radius: 'sharp', contrast: 'high', headingTracking: 0.02 },
  },
  {
    slug: 'brutal-neon',
    label: 'Brutal neon',
    tagline: 'Brut assumé. Noir total, rose fluo, blocs et bordures dures.',
    suitedFor: [],
    fonts: {
      display: { family: 'Space Mono', weights: [700] },
      body: { family: 'IBM Plex Mono', weights: [400, 500] },
    },
    neutrals: {
      bg: '#000000',
      surface: '#0a0a0a',
      text: '#ffffff',
      textMuted: '#8a8a8a',
      border: '#ffffff',
    },
    imageryMood: 'high-contrast brutalist photo, hard flash, pure black background, neon pink and cyan accents, raw unretouched, bold graphic blocks',
    ui: { radius: 'sharp', contrast: 'high', headingTracking: -0.04 },
  },
  {
    slug: 'y2k-pastel',
    label: 'Y2K pastel',
    tagline: 'Nostalgie 2000. Rose bonbon, lilas holographique, fun bulle.',
    suitedFor: [],
    fonts: {
      // "Chillax" isn't hosted on Google Fonts — Quicksand covers the same
      // rounded-pastel mood and is already wired in css-vars/runtime font maps.
      display: { family: 'Quicksand', weights: [500, 600] },
      body: { family: 'Poppins', weights: [400, 500, 600] },
    },
    neutrals: {
      bg: '#fdf0f7',
      surface: '#ffffff',
      text: '#3a2a3f',
      textMuted: '#8a7590',
      border: '#f3d9ea',
    },
    imageryMood: 'y2k pastel product photo, soft dreamy light, holographic and glossy textures, bubblegum pink and lilac, playful nostalgic 2000s mood',
    ui: { radius: 'pill', contrast: 'low', headingTracking: -0.01 },
  },
  {
    slug: 'mono-architect',
    label: 'Mono architect',
    tagline: 'Plan d\'architecte. Gris béton, noir pur, grille rigoureuse.',
    suitedFor: [],
    fonts: {
      // "Neue Haas Grotesk" is commercial/not on Google Fonts — Inter is the
      // closest neutral grotesque already supported by the font loader.
      display: { family: 'Inter', weights: [500, 700] },
      body: { family: 'Inter', weights: [400, 500] },
    },
    neutrals: {
      bg: '#ededec',
      surface: '#f7f7f6',
      text: '#111111',
      textMuted: '#6e6e6e',
      border: '#cfcfce',
    },
    imageryMood: 'architectural photograph, flat even light, concrete and glass, strict grid geometry, greyscale monochrome, precise structural lines',
    ui: { radius: 'sharp', contrast: 'high', headingTracking: -0.03 },
  },
  {
    slug: 'botanical-green',
    label: 'Botanical green',
    tagline: 'Serre urbaine. Verts feuillage, terre cuite, fraîcheur végétale.',
    suitedFor: [],
    fonts: {
      display: { family: 'Fraunces', weights: [500, 600] },
      body: { family: 'Nunito Sans', weights: [400, 600] },
    },
    neutrals: {
      bg: '#f3f6ee',
      surface: '#fbfcf7',
      text: '#1e2a1c',
      textMuted: '#5f6e58',
      border: '#d9e2cd',
    },
    imageryMood: 'botanical lifestyle photo, bright greenhouse daylight, lush foliage and terracotta pots, fresh green palette, organic natural textures',
    ui: { radius: 'soft', contrast: 'medium', headingTracking: -0.01 },
  },
  {
    slug: 'coastal-nautical',
    label: 'Coastal nautical',
    tagline: 'Bord de mer. Bleu marine, écume blanche, laiton et voile.',
    suitedFor: [],
    fonts: {
      display: { family: 'Libre Franklin', weights: [600, 700] },
      body: { family: 'Source Sans 3', weights: [400, 500] },
    },
    neutrals: {
      bg: '#f4f7f9',
      surface: '#ffffff',
      text: '#16273a',
      textMuted: '#5b708a',
      border: '#d5e0e8',
    },
    imageryMood: 'coastal photo, bright airy seaside light, navy and white with brass, rope and sailcloth textures, crisp maritime palette',
    ui: { radius: 'soft', contrast: 'medium', headingTracking: -0.015 },
  },
  {
    slug: 'diner-retro',
    label: 'Diner retro',
    tagline: 'Diner américain. Crème vanille, rouge cerise, néon turquoise.',
    suitedFor: [],
    fonts: {
      display: { family: 'Bebas Neue', weights: [400] },
      body: { family: 'Roboto Slab', weights: [400, 500] },
    },
    neutrals: {
      bg: '#fdf6e3',
      surface: '#fffaf0',
      text: '#2a1c14',
      textMuted: '#7a5c48',
      border: '#e8d3ad',
    },
    imageryMood: 'retro american diner photo, warm neon glow, chrome and formica, cherry red and cream, 1950s nostalgic Americana mood',
    ui: { radius: 'pill', contrast: 'high', headingTracking: 0.01 },
  },
  {
    slug: 'wabi-sabi',
    label: 'Wabi-sabi',
    tagline: 'Wabi-sabi. Argile, sumi, beauté de l\'imperfection tranquille.',
    suitedFor: [],
    fonts: {
      display: { family: 'Shippori Mincho', weights: [500, 600] },
      body: { family: 'Zen Kaku Gothic New', weights: [400, 500] },
    },
    neutrals: {
      bg: '#f0ece3',
      surface: '#f7f4ec',
      text: '#2b2721',
      textMuted: '#776f64',
      border: '#ddd5c6',
    },
    imageryMood: 'wabi-sabi still life photo, soft natural shadow, raw clay and aged wood, muted earth palette, imperfect handmade textures, serene emptiness',
    ui: { radius: 'soft', contrast: 'low', headingTracking: 0.01 },
  },
  {
    slug: 'desert-terracotta',
    label: 'Desert terracotta',
    tagline: 'Désert au crépuscule. Terre cuite, sable, cactus et argile chaude.',
    suitedFor: [],
    fonts: {
      display: { family: 'Bricolage Grotesque', weights: [600, 700] },
      body: { family: 'DM Sans', weights: [400, 500] },
    },
    neutrals: {
      bg: '#f6ece0',
      surface: '#fcf5eb',
      text: '#3a281c',
      textMuted: '#8a6a52',
      border: '#e6cdb2',
    },
    imageryMood: 'desert lifestyle photo, warm low golden light, terracotta and sand tones, adobe and cactus textures, sun-baked earthy palette',
    ui: { radius: 'soft', contrast: 'medium', headingTracking: -0.015 },
  },
];

export function getPreset(slug: string | null | undefined): DesignPreset {
  return DESIGN_PRESETS.find((p) => p.slug === slug) ?? DESIGN_PRESETS[0]!;
}

/**
 * Locked, structured palette stored in `dropship_stores.palette`. The agent
 * + user decide it once at creation time and templates read from this
 * single source of truth.
 */
export interface StorePalette {
  primary: string;
  accent: string;
  bg: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  success: string;
  danger: string;
}

export function buildPaletteFromPreset(
  preset: DesignPreset,
  primary: string,
  accent: string,
): StorePalette {
  return {
    primary,
    accent,
    bg: preset.neutrals.bg,
    surface: preset.neutrals.surface,
    text: preset.neutrals.text,
    textMuted: preset.neutrals.textMuted,
    border: preset.neutrals.border,
    success: '#16a34a',
    danger: '#dc2626',
  };
}
