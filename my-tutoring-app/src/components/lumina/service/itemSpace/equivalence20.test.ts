import { describe, expect, it } from 'vitest';
import { EQUIVALENCE_20, equivalence20Items, sidesOf } from './equivalence20';
import { TIER_BANDS } from './index';
import { questionFitsSpec } from '../knowledge-check/itemSpaceProblems';

/** The value that makes left = right, found by trying every box value. */
const solve = (left: string, right: string): number => {
  const ev = (side: string, v: number) => Function(`return ${side.replace('?', String(v))}`)() as number;
  for (let v = 0; v <= 40; v++) if (ev(left, v) === ev(right, v)) return v;
  return NaN;
};

describe('equivalence-20', () => {
  it('every item is in scope, has no zero, and its answer makes both sides equal', () => {
    for (const it of equivalence20Items()) {
      const { left, right } = sidesOf(it);
      expect(solve(left, right)).toBe(it.answer);
      expect(it.answer).toBeGreaterThanOrEqual(1);
      for (const n of `${left} ${right}`.match(/\d+/g)!.map(Number)) {
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(20);
      }
      expect(Function(`return ${left}`)()).toBeLessThanOrEqual(20);
    }
  });

  it('every tier fills distinct items across several structures; harder tiers hold more both-sides items', () => {
    const shares = Object.values(TIER_BANDS).map(([lo, hi]) => {
      const picks = EQUIVALENCE_20.pick(8, lo, hi);
      expect(picks).toHaveLength(8);
      expect(new Set(picks.map((p) => `${sidesOf(p).left}=${sidesOf(p).right}`)).size).toBe(8);
      expect(new Set(picks.map((p) => p.structure)).size).toBeGreaterThan(2);
      expect(picks.every((p) => p.beta >= lo && p.beta <= hi)).toBe(true);
      return equivalence20Items().filter((p) => p.beta >= lo && p.beta <= hi).filter((p) => p.kind === 'both').length
        / equivalence20Items().filter((p) => p.beta >= lo && p.beta <= hi).length;
    });
    expect(shares[0]).toBeLessThan(shares[1]);
    expect(shares[1]).toBeLessThan(shares[2]);
    // Standard a + b = ? never reaches hard; both-sides with a crossing never sits in easy.
    expect(equivalence20Items().some((p) => p.kind === 'standard' && p.beta >= TIER_BANDS.hard[0])).toBe(false);
    expect(equivalence20Items().some((p) => p.kind === 'both' && p.features.bridges > 0 && p.beta < TIER_BANDS.easy[1])).toBe(false);
  });

  it('jitter: items of one structure differ by size only (at most 0.6 logits)', () => {
    const byStructure = new Map<string, number[]>();
    for (const it of equivalence20Items()) byStructure.set(it.structure, [...(byStructure.get(it.structure) ?? []), it.beta]);
    for (const betas of Array.from(byStructure.values())) expect(Math.max(...betas) - Math.min(...betas)).toBeLessThanOrEqual(0.6);
  });

  it('keeps the ItemSpace contract, and the "answer comes next" total leads the near options', () => {
    for (const it of equivalence20Items().filter((_, i) => i % 7 === 0)) {
      const sol = EQUIVALENCE_20.solve(it);
      const d = EQUIVALENCE_20.distractors(it);
      expect(d).toHaveLength(3);
      expect(new Set(d.map((x) => x.value)).size).toBe(3);
      expect(d.some((x) => x.value === sol.answer)).toBe(false);
      expect(d.some((x) => x.distance === 'far')).toBe(true);
      expect(d.every((x) => Number(x.value) >= 1 && Number(x.value) <= 20)).toBe(true);
      const plain = EQUIVALENCE_20.plainQuestion(it);
      expect(questionFitsSpec(plain, sol.shown, sol.answer)).toBe(true);
      expect(plain.includes(sol.equation!)).toBe(true);
      const total = Function(`return ${sidesOf(it).left}`)() as number;
      if (it.boxed && total !== it.answer && total <= 20) expect(d[0]).toEqual({ value: String(total), distance: 'near' });
    }
  });
});
