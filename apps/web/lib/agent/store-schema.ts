import { z } from 'zod';

export const RiskFieldsSchema = z.object({
  riskLevel: z.enum(['low', 'medium', 'high', 'unknown']).optional().default('unknown'),
  marketFit: z.string().optional().default('Non évalué'),
  selectionReason: z.string().optional().default('Sélection par pertinence niche'),
});

export const BrandingSchema = z.object({
  tagline: z.string().default(''),
  description: z.string().default(''),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/i).default('#000000'),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/i).default('#ffffff'),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/i).default('#ff0000'),
  logoEmoji: z.string().default('🛍️'),
});

export const GeneratedProductSchema = z.object({
  id: z.string(),
  originalTitle: z.string(),
  enrichedTitle: z.string(),
  enrichedDescription: z.string(),
  costCents: z.number().int().min(0),
  retailPriceCents: z.number().int().min(0),
  imageUrl: z.string().optional().default(''),
  supplierUrl: z.string().optional().default(''),
}).merge(RiskFieldsSchema);

export const GeneratedCatalogSchema = z.object({
  products: z.array(GeneratedProductSchema).min(1),
  branding: BrandingSchema,
});

export const EnrichedProductSchema = z.object({
  index: z.number().int().min(0),
  enrichedTitle: z.string(),
  enrichedDescription: z.string(),
  retailPriceCents: z.number().int().min(0),
  costCents: z.number().int().min(0),
}).merge(RiskFieldsSchema);

export const EnrichedCatalogSchema = z.object({
  products: z.array(EnrichedProductSchema).min(1),
  branding: BrandingSchema,
});

// Smart components / landing content schema. Kept loose so partial fills and
// legacy rows do not break, but strict enough to detect the key blocks the
// storefront templates expect.
export const HeroBlockSchema = z.object({
  kicker: z.string().optional(),
  headline_html: z.string().optional(),
  lede: z.string().optional(),
});

export const PointSchema = z.object({
  title: z.string(),
  body: z.string(),
});

export const SpecSchema = z.object({
  key: z.string(),
  value: z.string(),
});

export const IncludedItemSchema = z.object({
  qty: z.string(),
  label: z.string(),
});

export const LandingContentSchema = z.object({
  hero: HeroBlockSchema.optional(),
  selling_points: z.array(PointSchema).optional(),
  showcase: HeroBlockSchema.optional(),
  beach_moment: HeroBlockSchema.optional(),
  specs: z.array(SpecSchema).optional(),
  trust_promises: z.array(PointSchema).optional(),
  included_items: z.array(IncludedItemSchema).optional(),
  final_cta: HeroBlockSchema.optional(),
});

export type LandingContentInput = z.infer<typeof LandingContentSchema>;
