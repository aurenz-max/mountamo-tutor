import { describe, expect, it } from 'vitest';
import { ADD_SUB_100, ADD_SUB_1000, multiDigitFeatures, multiDigitItem } from './multiDigit';
import { FRACTION_ADD_SUB, fractionItems, fractionText } from './fractionAddSub';
import { ROUNDING, roundingItems, roundTo } from './rounding';
import { TIER_BANDS, tierPick } from './index';
import { questionFitsSpec, questionMatchesOperation } from '../knowledge-check/itemSpaceProblems';
import { ADD_SUB_20, addSub20Items } from './addSub20';
import type { ItemSpace } from './types';

const contract = (space: ItemSpace<any>, items: any[], valueOf: (v: string) => number) => {
  for (const it of items) {
    const sol = space.solve(it);
    const d = space.distractors(it);
    expect(d).toHaveLength(3);
    expect(new Set(d.map((x) => valueOf(x.value))).size).toBe(3);
    expect(d.some((x) => valueOf(x.value) === valueOf(sol.answer))).toBe(false);
    expect(d.some((x) => x.distance === 'far')).toBe(true);
    expect(questionFitsSpec(space.plainQuestion(it), sol.shown, sol.answer)).toBe(true);
    expect(questionMatchesOperation(space.plainQuestion(it), sol.operation)).toBe(true);
  }
};

describe('operation cue check', () => {
  it('rejects a subtraction told as pouring more in, and an addition that asks what is left', () => {
    expect(questionMatchesOperation('Noah poured 1/2 of a gallon into a can that already held 1/6. How much water is in the can now?', '-')).toBe(false);
    expect(questionMatchesOperation('Emma had 3/4 of a yard and used 2/8 of it. How much is left?', '-')).toBe(true);
    expect(questionMatchesOperation('Leo had 9 apples and 4 were left. How many in all?', '+')).toBe(false);
    expect(questionMatchesOperation('What is 82 - 57?', '-')).toBe(true);
  });

  it('every add-sub-20 plain question reads as its operation', () => {
    for (const it of addSub20Items()) {
      const sol = ADD_SUB_20.solve(it);
      expect(questionMatchesOperation(ADD_SUB_20.plainQuestion(it), sol.operation)).toBe(true);
    }
  });
});
const num = (v: string) => Number(v);
const frac = (v: string) => {
  const m = v.match(/^(?:(\d+) )?(\d+)(?:\/(\d+))?$/)!;
  return m[3] ? Number(m[1] ?? 0) + Number(m[2]) / Number(m[3]) : Number(m[2]);
};

describe('multi-digit add/subtract (within 100, within 1000)', () => {
  it('reads the column work: regroupings, a borrow across a zero, a chain', () => {
    expect(multiDigitFeatures(23, 45, '+')).toMatchObject({ regroups: 0, chain: 0 });
    expect(multiDigitFeatures(158, 47, '+')).toMatchObject({ regroups: 2, chain: 1 });
    expect(multiDigitFeatures(403, 127, '-')).toMatchObject({ regroups: 2, acrossZero: 1, borrow: 1 });
    expect(multiDigitFeatures(82, 57, '-')).toMatchObject({ regroups: 1, acrossZero: 0 });
  });

  for (const [space, max] of [[ADD_SUB_100, 100], [ADD_SUB_1000, 1000]] as const) {
    it(`${space.id}: every tier fills distinct items in scope; harder tiers regroup more`, () => {
      const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
      const regroups: number[] = [];
      for (const [lo, hi] of Object.values(TIER_BANDS)) {
        const picks = space.pick(8, lo, hi);
        expect(picks).toHaveLength(8);
        expect(picks.every((p) => p.beta >= lo && p.beta <= hi)).toBe(true);
        for (const p of picks) {
          const r = p.op === '+' ? p.a + p.b : p.a - p.b;
          expect(r >= 1 && r <= max).toBe(true);
          if (max === 1000) expect(Math.max(p.a, p.b)).toBeGreaterThanOrEqual(100);
          else expect(Math.max(p.a, p.b)).toBeLessThan(100);
        }
        expect(new Set(picks.map((p) => p.structure)).size).toBeGreaterThan(1);
        regroups.push(mean(picks.map((p) => p.features.regroups + p.features.acrossZero)));
      }
      expect(regroups[0]).toBeLessThan(regroups[2]);
      contract(space, space.pick(60, -3, 4), num);
    });
  }

  it('jitter control: same structure, different digits, same beta', () => {
    expect(multiDigitItem(23, 45, '+', 100).beta).toBe(multiDigitItem(32, 54, '+', 100).beta);
    expect(multiDigitItem(403, 127, '-', 1000).beta).toBe(multiDigitItem(806, 349, '-', 1000).beta);
  });
});

describe('fraction-add-sub', () => {
  it('answers in simplest form and every item stays a proper sum below 2 or a positive difference', () => {
    expect(fractionText(6, 8)).toBe('3/4');
    expect(fractionText(10, 8)).toBe('1 1/4');
    expect(fractionText(8, 8)).toBe('1');
    for (const it of fractionItems()) {
      const v = frac(FRACTION_ADD_SUB.solve(it).answer);
      const exact = it.op === '+' ? it.a / it.b + it.c / it.d : it.a / it.b - it.c / it.d;
      expect(Math.abs(v - exact)).toBeLessThan(1e-9);
      expect(v > 0 && v < 2).toBe(true);
    }
  });

  it('bands separate: unlike-both denominators concentrate at hard, like ones at easy', () => {
    const share = (band: [number, number], f: (it: any) => boolean) => {
      const p = FRACTION_ADD_SUB.pick(10, ...band);
      expect(p).toHaveLength(10);
      expect(new Set(p.map((x) => x.structure)).size).toBeGreaterThan(2);
      return p.filter(f).length / p.length;
    };
    expect(share(TIER_BANDS.hard, (it) => it.features.unlikeBoth)).toBeGreaterThan(share(TIER_BANDS.easy, (it) => it.features.unlikeBoth));
    contract(FRACTION_ADD_SUB, fractionItems(), frac);
  });
});

describe('round-10-100', () => {
  it('rounds half up, and the bands move from tens to hundreds and the 5-rule', () => {
    expect(roundTo(35, 10)).toBe(40);
    expect(roundTo(96, 10)).toBe(100);
    expect(roundTo(950, 100)).toBe(1000);
    expect(roundTo(349, 100)).toBe(300);
    const toHundred = (band: [number, number]) => {
      const p = ROUNDING.pick(10, ...band);
      expect(p).toHaveLength(10);
      expect(new Set(p.map((x) => x.n)).size).toBe(10);
      return p.filter((x) => x.place === 100).length;
    };
    expect(toHundred(TIER_BANDS.hard)).toBeGreaterThan(toHundred(TIER_BANDS.easy));
    contract(ROUNDING, roundingItems(), num);
  });
});

import { FRACTION_EQUIVALENCE, equivalenceAnswer, equivalenceItems } from './fractionEquivalence';

describe('fraction-equivalence', () => {
  it('every item is a true equivalence with a whole-number answer, denominators 2..12', () => {
    for (const it of equivalenceItems()) {
      const n = equivalenceAnswer(it);
      expect(Number.isInteger(n)).toBe(true);
      expect(n / it.d).toBeCloseTo(it.a / it.b, 9);
      expect(it.d).not.toBe(it.b);
    }
  });

  it('bands separate: the two-step and merging items sit at hard, doublings of unit fractions at easy', () => {
    const share = (band: [number, number], f: (it: any) => boolean) => {
      const p = FRACTION_EQUIVALENCE.pick(8, ...band);
      expect(p).toHaveLength(8);
      expect(new Set(p.map((x) => `${x.a}/${x.b}`)).size).toBe(8);
      return p.filter(f).length / p.length;
    };
    const heavy = (it: any) => it.features.across || it.features.down;
    expect(share(TIER_BANDS.hard, heavy)).toBeGreaterThan(share(TIER_BANDS.easy, heavy));
    contract(FRACTION_EQUIVALENCE, equivalenceItems(), num);
  });

  it('within the K-2 denominators (to 4), every tier still fills or none does', () => {
    const scope = (it: any) => it.b <= 4 && it.d <= 4;
    for (const band of Object.values(TIER_BANDS)) {
      const p = tierPick(FRACTION_EQUIVALENCE, undefined, scope)(5, band[0], band[1], Math.random, scope);
      expect([0, 5]).toContain(p.length);
    }
  });
});
