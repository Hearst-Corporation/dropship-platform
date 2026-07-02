/**
 * Vision gate rules: text-bearing supplier images (overlays, prices, badges,
 * watermarks) are disqualifying below the trust score even when the numeric
 * score clears the collection threshold.
 */

import { describe, expect, it } from 'vitest';
import { passesVisionGate, type ImageQualityVerdict } from './image-quality';

function verdict(score: number, issues: string[] = []): ImageQualityVerdict {
  return { score, issues, reason: 'test' };
}

describe('passesVisionGate', () => {
  it('keeps a clean image above threshold', () => {
    expect(passesVisionGate(verdict(0.6), 0.5)).toBe(true);
  });

  it('rejects below threshold regardless of issues', () => {
    expect(passesVisionGate(verdict(0.4), 0.5)).toBe(false);
  });

  it('rejects a text_overlay image that only clears the lax collection threshold', () => {
    expect(passesVisionGate(verdict(0.55, ['text_overlay']), 0.5)).toBe(false);
  });

  it('rejects price_tag / discount_badge / watermark the same way', () => {
    for (const issue of ['price_tag', 'discount_badge', 'watermark']) {
      expect(passesVisionGate(verdict(0.6, [issue]), 0.5)).toBe(false);
    }
  });

  it('trusts a text-flagged image when the model scored it very high', () => {
    expect(passesVisionGate(verdict(0.8, ['text_overlay']), 0.5)).toBe(true);
  });

  it('non-text issues (busy_background) pass on score alone', () => {
    expect(passesVisionGate(verdict(0.55, ['busy_background']), 0.5)).toBe(true);
  });
});
