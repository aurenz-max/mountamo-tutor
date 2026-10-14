import { describe, expect, it } from 'vitest';
import { ADD_SUB_20, addSub20Items } from '../itemSpace/addSub20';
import { TIER_BANDS, tierPick } from '../itemSpace';
import { answerOfItem, claimFor, equationOf, itemFitsMode, optionsFor, type EbSpaceMode } from './equationBuilderItemSpace';

const MODES: EbSpaceMode[] = ['missing-result', 'missing-operand', 'true-false'];
const solve = (eq: string): number => {
  // a op b = c with one "?": the value that makes it true.
  const [l, r] = eq.split('=').map((x) => x.trim());
  for (let v = 0; v <= 40; v++) {
    const ev = (side: string) => Function(`return ${side.replace('?', String(v))}`)() as number;
    if (ev(l) === ev(r)) return v;
  }
  return NaN;
};

describe('equation-builder facts from add-sub-20', () => {
  it('each mode draws one-step items in scope with the right unknown, and the equation solves to the answer', () => {
    for (const mode of MODES) for (const max of [5, 10, 20]) for (const it of addSub20Items()) {
      if (!itemFitsMode(it, mode, max, true)) continue;
      expect(it.steps).toHaveLength(1);
      expect(mode === 'missing-operand' ? it.unknown !== 'result' : it.unknown === 'result').toBe(true);
      if (mode !== 'true-false') expect(solve(equationOf(it))).toBe(answerOfItem(it));
      for (const n of equationOf(it).match(/\d+/g)!.map(Number)) expect(n).toBeLessThanOrEqual(max);
    }
    expect(addSub20Items().some((it) => itemFitsMode(it, 'missing-result', 10, false) && it.steps[0].op === '-')).toBe(false);
  });

  it('every tier fills a session of distinct facts, mean beta rising with the tier (within 10 and 20)', () => {
    for (const mode of MODES) for (const max of [10, 20]) {
      const scope = (it: any) => itemFitsMode(it, mode, max, true);
      const means = Object.values(TIER_BANDS).map((band) => {
        const picks = tierPick(ADD_SUB_20, undefined, scope)(5, band[0], band[1], Math.random, scope);
        expect(picks).toHaveLength(5);
        expect(new Set(picks.map((p) => equationOf(p))).size).toBe(5);
        return picks.reduce((s, p) => s + p.beta, 0) / 5;
      });
      expect(means[0]).toBeLessThan(means[1]);
      expect(means[1]).toBeLessThan(means[2]);
    }
  });

  it('options hold the answer once and in-range wrong values; claims are true or a wrong value', () => {
    for (const it of addSub20Items().filter((x) => itemFitsMode(x, 'missing-operand', 20, true))) {
      for (const [count, spread] of [[3, 'far'], [4, undefined], [4, 'near']] as const) {
        const o = optionsFor(ADD_SUB_20, it, 20, count, spread);
        expect(o).toHaveLength(count);
        expect(new Set(o).size).toBe(count);
        expect(o.filter((v) => v === answerOfItem(it))).toHaveLength(1);
        expect(o.every((v) => v >= 0 && v <= 20)).toBe(true);
      }
    }
    for (const it of addSub20Items().filter((x) => itemFitsMode(x, 'true-false', 10, true))) {
      expect(claimFor(ADD_SUB_20, it, 10, true, false)).toBe(answerOfItem(it));
      const f = claimFor(ADD_SUB_20, it, 10, false, false);
      expect(f).not.toBe(answerOfItem(it));
      expect(f >= 0 && f <= 10).toBe(true);
    }
  });
});

describe('equation-builder balance-both-sides from equivalence-20', () => {
  it('draws no standard form, keeps every number and the box within the lesson, no minus without subtraction', async () => {
    const { equivalence20Items } = await import('../itemSpace/equivalence20');
    const { equivalenceFitsLesson, balanceSidesOf } = await import('./equationBuilderItemSpace');
    for (const max of [10, 20]) for (const sub of [true, false]) for (const it of equivalence20Items()) {
      if (!equivalenceFitsLesson(it, max, sub)) continue;
      const { left, right } = balanceSidesOf(it);
      expect(it.kind).not.toBe('standard');
      expect(right).toContain('?');
      if (!sub) expect(`${left} ${right}`).not.toContain('-');
      expect(Math.max(it.answer, ...`${left} ${right}`.match(/\d+/g)!.map(Number))).toBeLessThanOrEqual(max);
      expect(solve(`${left} = ${right}`)).toBe(it.answer);
    }
  });

  it('every tier fills a session of five distinct equations, mean beta rising (within 10 and 20)', async () => {
    const { EQUIVALENCE_20 } = await import('../itemSpace/equivalence20');
    const { equivalenceFitsLesson, balanceSidesOf } = await import('./equationBuilderItemSpace');
    for (const max of [10, 20]) {
      const scope = (it: any) => equivalenceFitsLesson(it, max, true);
      const means = Object.values(TIER_BANDS).map((band) => {
        const picks = tierPick(EQUIVALENCE_20, undefined, scope)(5, band[0], band[1], Math.random, scope);
        expect(picks).toHaveLength(5);
        expect(new Set(picks.map((p: any) => JSON.stringify(balanceSidesOf(p)))).size).toBe(5);
        return picks.reduce((s: number, p: any) => s + p.beta, 0) / 5;
      });
      expect(means[0]).toBeLessThan(means[1]);
      expect(means[1]).toBeLessThan(means[2]);
    }
  });
});
