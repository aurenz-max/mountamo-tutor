import { describe, expect, it } from 'vitest';
import { bonds10Items, BONDS_10 } from '../itemSpace/bonds10';
import { TIER_BANDS, tierPick } from '../itemSpace';
import { bondInstructionFits, decomposeWholes, itemAsBond, pickBonds, scopeBondCount, type BondType } from './numberBondItemSpace';

const TYPES: BondType[] = ['missing-part', 'related-fact', 'fact-family', 'build-equation'];

describe('number-bond bonds from bonds-10', () => {
  it('maps every part-unknown item in scope to a valid bond, and everything else to null', () => {
    for (const type of TYPES) for (const max of [5, 10]) for (const it of bonds10Items()) {
      const b = itemAsBond(it, type, max);
      const drawable = it.unknown === 'part' && it.whole <= max && !(type === 'related-fact' && it.known === it.other);
      expect(b !== null).toBe(drawable);
      if (b) {
        expect(b.part1 + b.part2).toBe(b.whole);
        expect(b.part1).toBeGreaterThanOrEqual(1);
        expect(b.part1).toBeLessThan(b.whole);
      }
    }
  });

  it('every tier fills a session of distinct bonds, at Grade 1 (to 10) and K (to 5)', () => {
    for (const type of TYPES) for (const [max, count] of [[10, 5], [5, 3]] as const) {
      const scope = (it: any) => itemAsBond(it, type, max) !== null;
      const means: number[] = [];
      // K related_fact has four unequal bonds (3=1+2, 4=1+3, 5=1+4, 5=2+3): too few to give each
      // tier three of its own, so it keeps the mode's own path rather than ship a short session.
      if (type === 'related-fact' && max === 5) {
        for (const band of Object.values(TIER_BANDS)) {
          const bonds = pickBonds({ pick: tierPick(BONDS_10, undefined, scope), band, count, type, maxNumber: max });
          expect([0, count]).toContain(bonds.length);
        }
        continue;
      }
      for (const band of Object.values(TIER_BANDS)) {
        const bonds = pickBonds({ pick: tierPick(BONDS_10, undefined, scope), band, count, type, maxNumber: max });
        expect(bonds).toHaveLength(count);
        expect(new Set(bonds.map((b) => `${b.whole}:${Math.min(b.part1, b.part2)}`)).size).toBe(count);
        means.push(bonds.reduce((s, b) => s + b.itemSpace.beta, 0) / count);
      }
      expect(means[0]).toBeLessThan(means[1]);
      expect(means[1]).toBeLessThan(means[2]);
    }
  });

  it('counts the bonds a scope holds: 25 within 10 (20 unequal), 6 within 5 (4 unequal)', () => {
    expect(scopeBondCount('missing-part', 10)).toBe(25);
    expect(scopeBondCount('related-fact', 10)).toBe(20);
    expect(scopeBondCount('missing-part', 5)).toBe(6);
    expect(scopeBondCount('related-fact', 5)).toBe(4);
  });

  it('decompose wholes rise with the tier at Grade 1 and stay in the window', () => {
    const avg = (t: 'easy' | 'medium' | 'hard') => decomposeWholes(t, 10, 3).reduce((s, w) => s + w, 0) / 3;
    for (let r = 0; r < 20; r++) {
      expect(avg('easy')).toBeLessThan(avg('hard'));
      for (const t of ['easy', 'medium', 'hard'] as const) {
        const w = decomposeWholes(t, 10, 3);
        expect(new Set(w).size).toBe(3);
        expect(w.every((x) => x >= 2 && x <= 10)).toBe(true);
      }
    }
    expect(decomposeWholes('hard', 5, 3).every((x) => x >= 2 && x <= 5)).toBe(true);
  });

  it('rejects an instruction that misses the bond or states the missing part', () => {
    const b = { whole: 9, part1: 2, part2: 7 };
    expect(bondInstructionFits('The whole is 9. One part is 2. What is the other part?', 'missing-part', b)).toBe(true);
    expect(bondInstructionFits('The whole is 9. One part is 2, the other is 7.', 'missing-part', b)).toBe(false);
    expect(bondInstructionFits('Find the other part of 9.', 'missing-part', b)).toBe(false);
    expect(bondInstructionFits('Say the two facts for 9.', 'related-fact', b)).toBe(true);
    expect(bondInstructionFits('2 and 7 make 9.', 'related-fact', b)).toBe(false);
  });
});
