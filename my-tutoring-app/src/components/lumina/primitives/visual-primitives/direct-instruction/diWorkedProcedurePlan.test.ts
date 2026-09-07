/**
 * The step chain is the pedagogy's ground truth, so its gates are pinned here
 * rather than trusted: a problem that slips one of them hands the judge a
 * discrimination the bench never measured.
 */

import { describe, it, expect } from 'vitest';
import {
  clampShape,
  drawProblems,
  numberWord,
  planSubtraction,
  reseedProblemPool,
} from './diWorkedProcedurePlan';

describe('numberWord — the pack\'s spoken range', () => {
  it('says two- and three-digit numbers the way the tutor does', () => {
    expect(numberWord(52)).toBe('fifty-two');
    expect(numberWord(40)).toBe('forty');
    expect(numberWord(13)).toBe('thirteen');
    expect(numberWord(342)).toBe('three hundred forty-two');
    expect(numberWord(300)).toBe('three hundred');
    expect(numberWord(107)).toBe('one hundred seven');
  });
  it('refuses out-of-range loudly rather than speaking undefined', () => {
    expect(() => numberWord(1000)).toThrow();
    expect(() => numberWord(-1)).toThrow();
  });
});

describe('planSubtraction — the canonical chain', () => {
  it('plans a single ones regroup and marks the tens as lent', () => {
    const plan = planSubtraction(52, 28)!;
    expect(plan).not.toBeNull();
    expect(plan.difference).toBe(24);
    expect(plan.regroupCount).toBe(1);
    const [ones, tens] = plan.columns;
    expect(ones).toMatchObject({ place: 'ones', top: 2, bottom: 8, regroup: true, effectiveTop: 12, difference: 4, lent: false });
    expect(tens).toMatchObject({ place: 'tens', top: 5, bottom: 2, lent: true, topAfterLend: 4, regroup: false, difference: 2 });
  });

  it('plans a column that both LENT and must REGROUP (the double mark)', () => {
    const plan = planSubtraction(342, 168)!;
    expect(plan.regroupCount).toBe(2);
    const [, tens, hundreds] = plan.columns;
    expect(tens).toMatchObject({ top: 4, lent: true, topAfterLend: 3, bottom: 6, regroup: true, effectiveTop: 13, difference: 7 });
    expect(hundreds).toMatchObject({ top: 3, lent: true, topAfterLend: 2, bottom: 1, regroup: false, difference: 1 });
  });

  it('REFUSES the flip coincidence — 53 − 28, where 8 − 3 = 13 − 8', () => {
    // The brief's own mock problem. The judge could not tell the flipped
    // column from the regrouped one by the digit, so the pack never ships it.
    expect(planSubtraction(53, 28)).toBeNull();
  });

  it('refuses a zero difference in any column', () => {
    expect(planSubtraction(53, 23)).toBeNull(); // ones 3 − 3
    expect(planSubtraction(342, 328)).toBeNull(); // hundreds 2 − 2 after the lend
  });

  it('refuses borrowing across a zero (the cascade rung)', () => {
    expect(planSubtraction(300, 148)).toBeNull();
    expect(planSubtraction(405, 178)).toBeNull();
  });

  it('refuses mismatched widths and non-positive differences', () => {
    expect(planSubtraction(52, 8)).toBeNull();
    expect(planSubtraction(28, 52)).toBeNull();
    expect(planSubtraction(52, 52)).toBeNull();
  });
});

describe('drawProblems — the code-owned pool', () => {
  it('draws the requested shape, distinct pairs, distinct ones facts', () => {
    reseedProblemPool(12345);
    const pairs = drawProblems({ digits: 2, regroups: 1 }, 4);
    expect(pairs).toHaveLength(4);
    const onesFacts = new Set<string>();
    for (const { minuend, subtrahend } of pairs) {
      const plan = planSubtraction(minuend, subtrahend)!;
      expect(plan).not.toBeNull();
      expect(plan.digits).toBe(2);
      expect(plan.regroupCount).toBe(1);
      onesFacts.add(`${plan.columns[0].top}-${plan.columns[0].bottom}`);
    }
    expect(onesFacts.size).toBe(4);
  });

  it('draws three-digit double regroups and no-regroup problems alike', () => {
    reseedProblemPool(777);
    for (const { minuend, subtrahend } of drawProblems({ digits: 3, regroups: 2 }, 3)) {
      expect(planSubtraction(minuend, subtrahend)!.regroupCount).toBe(2);
    }
    for (const { minuend, subtrahend } of drawProblems({ digits: 3, regroups: 0 }, 3)) {
      expect(planSubtraction(minuend, subtrahend)!.regroupCount).toBe(0);
    }
  });

  it('clamps an impossible two-digit double regroup to one', () => {
    expect(clampShape({ digits: 2, regroups: 2 })).toEqual({ digits: 2, regroups: 1 });
  });
});
