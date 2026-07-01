/**
 * Unit test — statusColor() maps semantic status strings (FR + EN,
 * case-insensitive) to the expected Catalyst <Badge> colors, and falls back to
 * 'zinc' for anything unknown.
 *
 * Pure function, no DOM: safe under vitest's node environment. We import only
 * the helper (not the JSX component) so nothing React-renders here.
 */

import { describe, it, expect } from 'vitest';
import { statusColor } from '@/components/admin/AdminBadge';

describe('statusColor', () => {
  it('maps positive/live statuses to lime', () => {
    for (const s of [
      'active',
      'actif',
      'online',
      'published',
      'publié',
      'live',
      'paid',
      'payé',
      'success',
      'succès',
      'completed',
      'connected',
    ]) {
      expect(statusColor(s)).toBe('lime');
    }
  });

  it('maps pending/in-progress statuses to amber', () => {
    for (const s of [
      'draft',
      'brouillon',
      'pending',
      'en attente',
      'creating',
      'création',
      'processing',
      'en cours',
      'running',
      'queued',
      'warning',
      'partial',
    ]) {
      expect(statusColor(s)).toBe('amber');
    }
  });

  it('maps error/cancelled/refunded statuses to red', () => {
    for (const s of [
      'error',
      'erreur',
      'failed',
      'failure',
      'échec',
      'cancelled',
      'canceled',
      'annulé',
      'refunded',
      'remboursé',
      'rejected',
    ]) {
      expect(statusColor(s)).toBe('red');
    }
  });

  it('maps paused/offline/inactive/archived and any unknown value to zinc', () => {
    for (const s of [
      'paused',
      'en pause',
      'offline',
      'inactive',
      'inactif',
      'archived',
      'archivé',
      'unknown',
      'inconnu',
      // Genuinely unknown values fall through to the zinc default.
      'wibble',
      'HTTP-418',
      '',
    ]) {
      expect(statusColor(s)).toBe('zinc');
    }
  });

  it('is case-insensitive and trims surrounding whitespace', () => {
    expect(statusColor('ACTIVE')).toBe('lime');
    expect(statusColor('  Published  ')).toBe('lime');
    expect(statusColor('Pending')).toBe('amber');
    expect(statusColor('  FAILED')).toBe('red');
    expect(statusColor('Archived  ')).toBe('zinc');
  });

  it('always returns one of the four Catalyst colors we use', () => {
    const allowed = new Set(['lime', 'amber', 'red', 'zinc']);
    for (const s of ['active', 'pending', 'error', 'paused', 'anything-else']) {
      expect(allowed.has(statusColor(s) as string)).toBe(true);
    }
  });
});
