import { describe, expect, it } from 'vitest';
import { TIER_BANDS } from './index';
import { questionFitsSpec, questionMatchesOperation } from '../knowledge-check/itemSpaceProblems';
import {
  CLOCK_TIME, ELAPSED_TIME, clockDistractors, clockItems, clockText, durationMinutes, elapsedEnd, elapsedItems,
  elapsedOnGrid, onGrid,
} from './time';
import { COIN_SETS, MAKE_CHANGE, changeItems, coinSetItems, coinsWithin, coinKindsIn, fewestCoins } from './money';
import type { ItemSpace } from './types';

const contract = (space: ItemSpace<any>, items: any[], valueOf: (v: string) => number, text = true) => {
  for (const it of items) {
    const sol = space.solve(it);
    const d = space.distractors(it);
    expect(d).toHaveLength(3);
    expect(new Set(d.map((x) => valueOf(x.value))).size).toBe(3);
    expect(d.some((x) => valueOf(x.value) === valueOf(sol.answer))).toBe(false);
    expect(d.some((x) => x.distance === 'far')).toBe(true);
    if (text) {
      expect(questionFitsSpec(space.plainQuestion(it), sol.shown, sol.answer)).toBe(true);
      expect(questionMatchesOperation(space.plainQuestion(it), sol.operation)).toBe(true);
    }
  }
};
const cents = (v: string) => Number(v.replace('¢', ''));
const clockMinutes = (v: string) => { const [h, m] = v.split(':').map(Number); return (h % 12) * 60 + m; };
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

describe('clock-time', () => {
  it('orders the minute classes the way children learn them, and late times above early ones', () => {
    const beta = (h: number, m: number) => clockItems().find((it) => it.h === h && it.m === m)!.beta;
    expect(beta(3, 0)).toBeLessThan(beta(3, 30));
    expect(beta(3, 30)).toBeLessThan(beta(3, 15));
    expect(beta(3, 15)).toBeLessThan(beta(3, 20));
    expect(beta(3, 20)).toBeLessThan(beta(3, 50));
    expect(beta(3, 20)).toBeLessThan(beta(3, 22));
    // jitter: the hour is incidental
    expect(beta(3, 20)).toBe(beta(8, 20));
  });

  it('every tier fills a five-minute session of distinct times and hours; hard holds later minutes', () => {
    const grid = onGrid(5);
    const lateShare: number[] = [];
    for (const [lo, hi] of Object.values(TIER_BANDS)) {
      const picks = CLOCK_TIME.pick(5, lo, hi, Math.random, grid);
      expect(picks).toHaveLength(5);
      expect(new Set(picks.map((p) => p.h)).size).toBe(5);
      lateShare.push(mean(picks.map((p) => p.features.late + p.features.five + p.features.oneMin)));
    }
    expect(lateShare[0]).toBeLessThan(lateShare[2]);
  });

  it('options: three distinct wrong times, one far; the hour misread and the swapped hands are near', () => {
    contract(CLOCK_TIME, clockItems().filter(onGrid(5)), clockMinutes, false);
    const at = (h: number, m: number) => clockItems().find((it) => it.h === h && it.m === m)!;
    const near = (h: number, m: number) => clockDistractors(at(h, m), () => 0.99).filter((d) => d.distance === 'near').map((d) => d.value);
    expect(near(2, 50)).toContain('3:50');
    // a grid keeps every option on it
    for (const it of clockItems().filter(onGrid(15))) {
      expect(clockDistractors(it, Math.random, 15).every((d) => Number(d.value.split(':')[1]) % 15 === 0)).toBe(true);
    }
    expect(clockText(12, 5)).toBe('12:05');
  });
});

describe('elapsed-time', () => {
  it('a duration that passes an hour mark mid-way is harder than one inside the hour', () => {
    const find = (sh: number, sm: number, d: number) => elapsedItems().find((it) => it.sh === sh && it.sm === sm && it.d === d)!;
    expect(find(3, 0, 30).beta).toBeLessThan(find(3, 50, 20).beta);
    expect(find(3, 50, 20).features.crossHour).toBe(1);
    expect(find(3, 40, 20).features.crossHour).toBe(0);
    expect(find(12, 40, 30).features.past12).toBe(1);
    expect(elapsedEnd(find(12, 40, 30))).toEqual({ h: 1, m: 10 });
    expect(elapsedEnd(find(11, 30, 30))).toEqual({ h: 12, m: 0 });
  });

  it('every tier fills distinct items on a quarter-hour grid; hard crosses the hour more', () => {
    const cross: number[] = [];
    for (const [lo, hi] of Object.values(TIER_BANDS)) {
      const picks = ELAPSED_TIME.pick(5, lo, hi, Math.random, elapsedOnGrid(5));
      expect(picks).toHaveLength(5);
      cross.push(mean(picks.map((p) => p.features.crossHour + p.features.mixed)));
    }
    expect(cross[0]).toBeLessThan(cross[2]);
    expect(elapsedItems().filter(elapsedOnGrid(15, 120)).every((it) => it.sm % 15 === 0 && it.d % 15 === 0)).toBe(true);
  });

  it('contract; the whole-number subtraction (410 − 350 = 60) is a near option', () => {
    contract(ELAPSED_TIME, elapsedItems().filter((_, i) => i % 7 === 0), durationMinutes);
    const it = elapsedItems().find((x) => x.sh === 3 && x.sm === 50 && x.d === 20)!;
    const opts = ELAPSED_TIME.distractors(it, () => 0.01).map((d) => durationMinutes(d.value));
    expect(opts).toContain(60);
    expect(durationMinutes('1 hour 25 minutes')).toBe(85);
  });
});

describe('coin-sets', () => {
  it('more kinds of coin and a quarter make a set harder; which coins of a kind is incidental', () => {
    const find = (q: number, d: number, n: number, p: number) => coinSetItems().find((it) =>
      it.coins.quarter === q && it.coins.dime === d && it.coins.nickel === n && it.coins.penny === p)!;
    expect(find(0, 3, 0, 0).beta).toBeLessThan(find(0, 2, 0, 3).beta);
    expect(find(0, 2, 0, 3).beta).toBeLessThan(find(1, 1, 1, 1).beta);
    expect(find(0, 2, 0, 3).beta).toBe(find(0, 3, 0, 2).beta);
  });

  it('every tier fills a mixed-coin session within a grade-1 pool; hard has more kinds', () => {
    const pool = coinsWithin(['quarter', 'dime', 'nickel', 'penny']);
    const mixed = (it: any) => pool(it) && coinKindsIn(it.coins).length >= 2;
    const kinds: number[] = [];
    for (const [lo, hi] of Object.values(TIER_BANDS)) {
      const picks = COIN_SETS.pick(5, lo, hi, Math.random, mixed);
      expect(picks).toHaveLength(5);
      expect(new Set(picks.map((p) => p.total)).size).toBe(5);
      kinds.push(mean(picks.map((p) => coinKindsIn(p.coins).length)));
    }
    expect(kinds[0]).toBeLessThan(kinds[2]);
  });

  it('contract; every coin counted as one is a near option; the fewest-coin set adds up', () => {
    contract(COIN_SETS, coinSetItems().filter((_, i) => i % 11 === 0), cents);
    expect(fewestCoins(67)).toEqual({ quarter: 2, dime: 1, nickel: 1, penny: 2 });
    expect(fewestCoins(30, ['dime', 'nickel', 'penny'])).toEqual({ quarter: 0, dime: 3, nickel: 0, penny: 0 });
  });
});

describe('make-change', () => {
  it('pays with a real coin or bill; a borrow across the zeros of 100 is hard', () => {
    expect(new Set(changeItems().map((it) => it.paid))).toEqual(new Set([25, 50, 100]));
    const find = (paid: number, cost: number) => changeItems().find((it) => it.paid === paid && it.cost === cost)!;
    expect(find(25, 15).beta).toBeLessThan(find(50, 27).beta);
    expect(find(50, 27).beta).toBeLessThan(find(100, 57).beta);
    for (const [lo, hi] of Object.values(TIER_BANDS)) expect(MAKE_CHANGE.pick(5, lo, hi)).toHaveLength(5);
  });

  it('contract; the undecremented regroup (50 − 27 = 33) is a near option', () => {
    contract(MAKE_CHANGE, changeItems(), cents);
    const opts = MAKE_CHANGE.distractors(changeItems().find((it) => it.paid === 50 && it.cost === 27)!, () => 0.01).map((d) => cents(d.value));
    expect(opts.some((v) => v === 33 || v === 37)).toBe(true);
  });
});
