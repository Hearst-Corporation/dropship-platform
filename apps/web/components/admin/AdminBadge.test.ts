/**
 * Unit test — statusColor() maps semantic status strings (FR + EN,
 * case-insensitive) to a Catalyst <Badge> color under the SINGLE-ACCENT policy:
 * the only hue allowed in the admin is the accent 'indigo' (for positive/active
 * states); every other state falls back to neutral 'zinc'. Error/warning states
 * are disambiguated by their label text, never by color.
 *
 * Pure function, no DOM: safe under vitest's node environment. We import only
 * the helper (not the JSX component) so nothing React-renders here.
 */

import { describe, it, expect } from 'vitest';
import { statusColor } from '@/components/admin/AdminBadge';

describe('statusColor (single-accent policy)', () => {
  it('maps positive/active/connected statuses to the accent (indigo)', () => {
    for (const s of [
      'active',
      'actif',
      'online',
      'en ligne',
      'published',
      'publié',
      'live',
      'ready',
      'prêt',
      'success',
      'succès',
      'completed',
      'connected',
      'connecté',
      'paid',
      'payé',
    ]) {
      expect(statusColor(s)).toBe('indigo');
    }
  });

  it('maps every non-positive state (pending, error, warning, paused, unknown) to neutral zinc', () => {
    for (const s of [
      // pending / in-progress
      'draft',
      'brouillon',
      'pending',
      'en attente',
      'creating',
      'création',
      'processing',
      'running',
      'warning',
      // error / cancelled
      'error',
      'erreur',
      'failed',
      'échec',
      'cancelled',
      'annulé',
      'refunded',
      'rejected',
      // paused / offline / archived
      'paused',
      'offline',
      'inactive',
      'archived',
      // genuinely unknown
      'unknown',
      'wibble',
      'HTTP-418',
      '',
    ]) {
      expect(statusColor(s)).toBe('zinc');
    }
  });

  it('is case-insensitive and trims surrounding whitespace', () => {
    expect(statusColor('ACTIVE')).toBe('indigo');
    expect(statusColor('  Published  ')).toBe('indigo');
    expect(statusColor('Pending')).toBe('zinc');
    expect(statusColor('  FAILED')).toBe('zinc');
    expect(statusColor('Archived  ')).toBe('zinc');
  });

  it('only ever returns the accent (indigo) or neutral (zinc) — no other hue', () => {
    const allowed = new Set(['indigo', 'zinc']);
    for (const s of ['active', 'pending', 'error', 'paused', 'anything-else', '']) {
      expect(allowed.has(statusColor(s) as string)).toBe(true);
    }
  });
});
