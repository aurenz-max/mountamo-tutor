import { describe, expect, it } from 'vitest';
import { selectBalanceScaleChallenges } from '../gemini-balance-scale';
import { checkAnswerVariety } from '../../qa/oracles/helpers';

/**
 * Statistical regression test for balance-scale answer clustering (the
 * bs-equality_hard / bs-two_step_intro oracle 422s): selection used to dedup
 * only on equation SHAPE, so a session could ship "the answer is always 6"
 * behind different constants. Selection must now spread variableValue.
 *
 * Each mode runs many times because the bug is stochastic — a single lucky
 * draw proves nothing. The clustering assertion is the oracle's own
 * checkAnswerVariety (>60% of answers sharing one value fails).
 */

const MODES = [
  'equality',
  'equality_hard',
  'one_step',
  'one_step_hard',
  'two_step_intro',
  'two_step',
] as const;

const RUNS = 300;

describe('selectBalanceScaleChallenges answer variety', () => {
  for (const mode of MODES) {
    it(`${mode}: no run clusters answers past the oracle threshold`, () => {
      for (let run = 0; run < RUNS; run++) {
        const challenges = selectBalanceScaleChallenges(mode);

        expect(challenges.length).toBeGreaterThanOrEqual(3);

        const violation = checkAnswerVariety(
          challenges.map((c) => c.variableValue),
          'challenges[].variableValue',
        );
        expect(violation, `run ${run}: ${violation?.detail}`).toBeNull();

        // No exact-duplicate equation (shape + answer) either — the other
        // clustering check the oracle applies.
        const keys = challenges.map((c) => {
          const side = (blocks: typeof c.leftSide) =>
            blocks.map((b) => (b.isVariable ? 'v' : `c${b.value}`)).sort().join('|');
          return `${side(c.leftSide)}=${side(c.rightSide)}|x=${c.variableValue}`;
        });
        expect(new Set(keys).size, `run ${run}: duplicate equation in [${keys.join(' ; ')}]`).toBe(keys.length);

        // Solvability invariant (mirrors the oracle's answer-key-desync solve):
        // the shipped variableValue is the x that actually balances the sides.
        for (const c of challenges) {
          const varCount = (blocks: typeof c.leftSide) => blocks.filter((b) => b.isVariable).length;
          const constSum = (blocks: typeof c.leftSide) =>
            blocks.reduce((s, b) => s + (b.isVariable ? 0 : b.value), 0);
          const denom = varCount(c.leftSide) - varCount(c.rightSide);
          expect(denom, 'variable must not cancel').not.toBe(0);
          const solved = (constSum(c.rightSide) - constSum(c.leftSide)) / denom;
          expect(solved).toBe(c.variableValue);
        }
      }
    });
  }
});
