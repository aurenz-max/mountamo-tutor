import { describe, expect, it } from 'vitest';
import { CLOCK_EVENTS, buildAmPmSession } from './clockAmPm';

const TIERS = ['easy', 'medium', 'hard', null] as const;
const eventOf = (name?: string) => CLOCK_EVENTS.find((e) => e.name === name)!;

describe('set_time_ampm sessions', () => {
  it.each(TIERS)('%s: five items, both periods, each time inside its event and never printing a.m. or p.m.', (tier) => {
    for (let i = 0; i < 200; i++) {
      const items = buildAmPmSession(tier);
      expect(items).toHaveLength(5);
      expect(new Set(items.map((c) => c.period))).toEqual(new Set(['am', 'pm']));
      for (const c of items) {
        const e = eventOf(c.event);
        expect(c.period).toBe(e.period);
        // The time is printed without its period; only the closing ask names a.m. and p.m.
        expect(c.instruction.replace('choose a.m. or p.m.', '')).not.toMatch(/a\.m\.|p\.m\.|\bnoon\b|\bmidnight\b/i);
        expect(c.instruction).toContain(`${c.targetHour}:${String(c.targetMinute).padStart(2, '0')}`);
        const h24 = e.period === 'pm' && c.targetHour !== 12 ? c.targetHour + 12 : e.period === 'am' && c.targetHour === 12 ? 0 : c.targetHour;
        const mins = h24 * 60 + c.targetMinute;
        expect(mins).toBeGreaterThanOrEqual(e.from);
        expect(mins).toBeLessThanOrEqual(e.to);
        expect(c.targetMinute % 5).toBe(0);
        expect(c.targetHour === 12 && c.targetMinute === 0).toBe(false);
        if (tier === 'easy') { expect(c.targetMinute % 30).toBe(0); expect(e.plain).toBe(true); }
        if (tier === 'medium') expect(c.targetMinute).toBeLessThan(40);
      }
    }
  });

  it('hard leads with the times children confuse', () => {
    let confusable = 0, total = 0;
    for (let i = 0; i < 200; i++) for (const c of buildAmPmSession('hard')) { total++; if (eventOf(c.event).confusable) confusable++; }
    expect(confusable / total).toBeGreaterThan(0.6);
  });
});
