import { describe, expect, it } from 'vitest';
import { getItemSpace, TIER_BANDS, tierPick } from '../itemSpace';
import { TWO_STEP_EQUATIONS, twoStepItems, twoStepTotal } from '../itemSpace/twoStepEquations';
import { questionFitsSpec } from '../knowledge-check/itemSpaceProblems';
import { BALANCE_SPACES, balanceSidesOf, equalitySides, equalityTargets } from './balanceScaleItemSpace';
import { workshopProblem } from '../../primitives/visual-primitives/math/balanceWorkshopModel';
import { equalityProblem } from '../../primitives/visual-primitives/math/balanceEqualityModel';
import type { BalanceScaleChallenge } from '../../primitives/visual-primitives/math/BalanceScale';

const MODES = ['one_step', 'one_step_hard', 'two_step_intro', 'two_step'] as const;
const challenge = (type: BalanceScaleChallenge['type'], sides: ReturnType<typeof equalitySides>): BalanceScaleChallenge =>
  ({ type, instruction: '', hint: '', ...sides });

describe('balance-scale challenges from item spaces', () => {
  it('every drawable item is a valid workshop problem whose parcel weight is the key', () => {
    for (const mode of MODES) {
      const space = getItemSpace(BALANCE_SPACES[mode]!.space);
      let drawn = 0;
      for (const it of space.items!()) {
        const sides = balanceSidesOf(mode, it);
        if (!sides) continue;
        drawn++;
        const p = workshopProblem(challenge(mode, sides), 0);
        expect(p.target).toBe(sides.variableValue);
        expect(p.total).toBe(p.parcels * p.target + p.known);
        expect(sides.rightSide.map((b) => b.value)).not.toContain(sides.variableValue === p.total ? -1 : sides.variableValue);
      }
      expect(drawn).toBeGreaterThan(20);
    }
  });

  it('every tier fills a session of distinct items across several structures, mean beta rising', () => {
    for (const mode of MODES) {
      const space = getItemSpace(BALANCE_SPACES[mode]!.space);
      const scope = (it: unknown) => balanceSidesOf(mode, it) !== null;
      const means = Object.values(TIER_BANDS).map(([lo, hi]) => {
        const picks = tierPick(space, undefined, scope)(5, lo, hi, Math.random, scope);
        expect(picks, mode).toHaveLength(5);
        expect(new Set(picks.map((p) => JSON.stringify(balanceSidesOf(mode, p)))).size).toBe(5);
        expect(new Set(picks.map((p) => p.structure)).size).toBeGreaterThan(1);
        return picks.reduce((s, p) => s + p.beta, 0) / 5;
      });
      expect(means[0], mode).toBeLessThan(means[1]);
      expect(means[1], mode).toBeLessThan(means[2]);
    }
  });

  it('matching targets: each tier gives distinct valid targets from a higher window', () => {
    for (const mode of ['equality', 'equality_hard'] as const) {
      const max = (tier: 'easy' | 'medium' | 'hard') => Math.max(...equalityTargets(mode, tier, 5, () => 0.99));
      for (const tier of ['easy', 'medium', 'hard'] as const) {
        const t = equalityTargets(mode, tier, 5);
        expect(new Set(t).size).toBe(5);
        for (const v of t) {
          if (mode === 'equality') expect(equalityProblem(challenge(mode, equalitySides(v)), 0).target).toBe(v);
          else expect(workshopProblem(challenge(mode, equalitySides(v)), 0).target).toBe(v);
        }
      }
      expect(max('easy')).toBeLessThan(max('medium'));
      expect(max('medium')).toBeLessThan(max('hard'));
    }
  });
});

describe('two-step-equations', () => {
  it('keeps the ItemSpace contract', () => {
    for (const it of twoStepItems()) {
      const sol = TWO_STEP_EQUATIONS.solve(it);
      expect((twoStepTotal(it) - it.q) / it.p).toBe(Number(sol.answer));
      const d = TWO_STEP_EQUATIONS.distractors(it);
      expect(d).toHaveLength(3);
      expect(new Set(d.map((x) => x.value)).size).toBe(3);
      expect(d.some((x) => x.value === sol.answer)).toBe(false);
      expect(d.some((x) => x.distance === 'far')).toBe(true);
      expect(questionFitsSpec(TWO_STEP_EQUATIONS.plainQuestion(it), sol.shown, sol.answer)).toBe(true);
    }
  });

  it('harder bands hold more hard facts and borrows', () => {
    const load = Object.values(TIER_BANDS).map(([lo, hi]) => {
      const band = twoStepItems().filter((it) => it.beta >= lo && it.beta <= hi);
      expect(band.length).toBeGreaterThan(20);
      return band.reduce((s, it) => s + it.features.hardFactors + it.features.borrow, 0) / band.length;
    });
    expect(load[0]).toBeLessThan(load[1]);
    expect(load[1]).toBeLessThan(load[2]);
  });
});
