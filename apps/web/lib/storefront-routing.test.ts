import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { pickStorefrontComponent } from '@/lib/storefront-routing';
import { getTemplateEntry } from '@/lib/template-catalog';
import type { StoreConfig } from '@/lib/store-config';
import type { StoreProduct } from '@/lib/medusa-store';

function componentName(el: ReactElement): string {
  const t = el.type;
  if (typeof t === 'function') return t.name;
  return String(t);
}

const baseStore = {
  slug: 'test',
  name: 'Test Store',
  heroImageUrl: 'https://example.com/hero.jpg',
  landingContent: { hero: { headline_html: 'Hi' } },
} as unknown as StoreConfig;

const products = [{ id: 'p1' }] as StoreProduct[];

describe('pickStorefrontComponent', () => {
  it('routes luxury-mono to MonoProductLanding when hero/landing exist', () => {
    const entry = getTemplateEntry('luxury-mono');
    const el = pickStorefrontComponent(entry, { store: baseStore, products });
    expect(componentName(el)).toBe('MonoProductLanding');
  });

  it('routes luxury-minimal to StorefrontShowcase', () => {
    const entry = getTemplateEntry('luxury-minimal');
    const el = pickStorefrontComponent(entry, { store: baseStore, products });
    expect(componentName(el)).toBe('StorefrontShowcase');
  });

  it('routes mono template to MonoProductLanding', () => {
    const entry = getTemplateEntry('mono');
    const el = pickStorefrontComponent(entry, { store: baseStore, products });
    expect(componentName(el)).toBe('MonoProductLanding');
  });

  it('falls back to StorefrontMinimal for mono without assets', () => {
    const entry = getTemplateEntry('mono');
    const store = { ...baseStore, heroImageUrl: null, landingContent: null } as unknown as StoreConfig;
    const el = pickStorefrontComponent(entry, { store, products });
    expect(componentName(el)).toBe('StorefrontMinimal');
  });

  it('routes wellness-soft (split) to StorefrontBold', () => {
    const entry = getTemplateEntry('wellness-soft');
    const el = pickStorefrontComponent(entry, { store: baseStore, products });
    expect(componentName(el)).toBe('StorefrontBold');
  });
});
