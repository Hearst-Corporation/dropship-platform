import { describe, expect, it } from 'vitest';
import { getUpcomingCommercialEvents, type CommercialEventId } from './prompts';

describe('getUpcomingCommercialEvents', () => {
  const ALL_IDS: CommercialEventId[] = [
    'new-year',
    'valentines',
    'mothers-day',
    'summer',
    'back-to-school',
    'black-friday',
    'christmas',
  ];

  it('returns Black Friday with a small daysAway and Christmas with a larger one for a Nov 1 reference date', () => {
    const referenceDate = new Date('2026-11-01T00:00:00.000Z');
    const events = getUpcomingCommercialEvents(referenceDate);

    const blackFriday = events.find((e) => e.id === 'black-friday' && e.label.startsWith('Black Friday'));
    const christmas = events.find((e) => e.id === 'christmas');

    expect(blackFriday).toBeDefined();
    expect(christmas).toBeDefined();
    expect(blackFriday!.daysAway).toBeGreaterThan(0);
    expect(blackFriday!.daysAway).toBeLessThan(30);
    expect(christmas!.daysAway).toBeGreaterThan(blackFriday!.daysAway);
  });

  it('is sorted soonest-first by daysAway', () => {
    const referenceDate = new Date('2026-11-01T00:00:00.000Z');
    const events = getUpcomingCommercialEvents(referenceDate);
    for (let i = 1; i < events.length; i++) {
      expect(events[i].daysAway).toBeGreaterThanOrEqual(events[i - 1].daysAway);
    }
  });

  it('is deterministic for a fixed reference date (no reliance on real current date)', () => {
    const referenceDate = new Date('2026-01-15T00:00:00.000Z');
    const first = getUpcomingCommercialEvents(referenceDate);
    const second = getUpcomingCommercialEvents(referenceDate);
    expect(first).toEqual(second);
  });

  it('covers all 7 expected event ids across the year (rolling reference dates)', () => {
    // A single reference date only sees events within the next 100 days, so
    // sample reference dates spread across the year to confirm every id is
    // reachable at some point (id set matches the future SeasonalTag union).
    const seenIds = new Set<CommercialEventId>();
    for (let month = 0; month < 12; month++) {
      const referenceDate = new Date(2026, month, 1);
      for (const e of getUpcomingCommercialEvents(referenceDate)) {
        seenIds.add(e.id);
      }
    }
    for (const id of ALL_IDS) {
      expect(seenIds.has(id)).toBe(true);
    }
  });

  it('returns ISO date strings and only events within the -7..100 day window', () => {
    const referenceDate = new Date('2026-06-01T00:00:00.000Z');
    const events = getUpcomingCommercialEvents(referenceDate);
    for (const e of events) {
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.daysAway).toBeGreaterThanOrEqual(-7);
      expect(e.daysAway).toBeLessThanOrEqual(100);
    }
  });
});
