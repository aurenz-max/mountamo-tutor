import { describe, expect, it } from 'vitest';
import { getItemSpace } from '../itemSpace';
import { scaledSecond } from '../itemSpace/ratioMissingValue';
import { DNL_MAX_INPUT, pickDnlSession } from './doubleNumberLineItemSpace';

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

describe('double-number-line find_missing sessions from the ratio space', () => {
  it('every tier gives one base ratio, 4 distinct asks on the line, not the given; harder tiers rank higher', () => {
    const space = getItemSpace('ratio-missing-value');
    const means = (['easy', 'medium', 'hard'] as const).map((t) => {
      const betas: number[] = [];
      for (let run = 0; run < 20; run++) {
        const s = pickDnlSession(space, t, 4)!;
        expect(s).not.toBeNull();
        expect(new Set(s.asks.map((x) => x.k)).size).toBe(4);
        for (const x of s.asks) {
          expect(x.a).toBe(s.a);
          expect(x.b).toBe(s.b);
          expect(x.k).not.toBe(s.a);
          expect(x.k).toBeLessThanOrEqual(DNL_MAX_INPUT);
          expect(Number.isInteger(scaledSecond(x))).toBe(true);
          betas.push(x.beta);
        }
      }
      return mean(betas);
    });
    expect(means[0]).toBeLessThan(means[1]);
    // Easy bases are mostly whole rates; hard ones mostly not.
    expect(means[1]).toBeLessThan(means[2]);
  });
});
