import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  FormulaLabChallengeType,
  FormulaLabDirection,
} from '../../primitives/visual-primitives/math/FormulaLab';
import { evaluateFormulaExpression } from '../../primitives/visual-primitives/math/formulaLabMath';

vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: vi.fn() } },
}));

import {
  analyzeFormulaProblemShape,
  buildChallenges,
  buildFallback,
  formulaMatchesProblemShape,
  resolveProblemShape,
  selectStructuralCandidate,
  type CandidateChallenge,
  type ValidatedWrapper,
} from './gemini-formula-lab';

const MODES: FormulaLabChallengeType[] = [
  'free-explore',
  'predict-direction',
  'predict-magnitude',
  'construct-formula',
  'transfer-apply',
];

const candidate = (
  relativeChange: number,
  direction: FormulaLabDirection = 'increase',
): CandidateChallenge => ({
  changedVariableSymbol: 'm',
  baselineValues: [4, 3],
  targetValues: [8, 3],
  expectedBaselineOutput: 100,
  expectedTargetOutput: direction === 'decrease'
    ? 100 * (1 - relativeChange)
    : 100 * (1 + relativeChange),
  correctDirection: direction,
});

const bandDistance = (
  value: number,
  band: NonNullable<ReturnType<typeof resolveProblemShape>['relativeChangeBand']>,
): number => value < band.min ? band.min - value : value > band.max ? value - band.max : 0;

const wrapper: ValidatedWrapper = {
  title: 'Force and Motion Formula Lab',
  description: 'Explore how mass and acceleration affect force.',
  context: 'Force is the product of mass and acceleration.',
  transferContext: 'Apply the same relationship to a second cart.',
  formulaLatex: 'F = m \\cdot a',
  expression: 'm * a',
  outputSymbol: 'F',
  outputName: 'Force',
  outputUnit: 'N',
  variables: [
    { symbol: 'm', name: 'Mass', unit: 'kg', min: 1, max: 12, step: 1, defaultValue: 4, accent: 'amber' },
    { symbol: 'a', name: 'Acceleration', unit: 'm/s^2', min: 1, max: 10, step: 1, defaultValue: 3, accent: 'cyan' },
  ],
  sceneKind: 'motion',
  challengeType: 'predict-magnitude',
  gradeBand: '6-12',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Formula Lab structural difficulty', () => {
  it('defines the confirmed formula-shape ladder for every mode', () => {
    for (const mode of MODES) {
      expect(resolveProblemShape(mode, 'easy')).toMatchObject({
        variableCount: 2,
        minOperatorCount: 1,
        maxOperatorCount: 1,
        requireInverseOrPower: false,
        forbidInverseOrPower: true,
        requireMixedRoles: false,
      });
      expect(resolveProblemShape(mode, 'medium')).toMatchObject({
        variableCount: 2,
        minOperatorCount: 1,
        maxOperatorCount: 2,
        requireInverseOrPower: true,
        forbidInverseOrPower: false,
        requireMixedRoles: false,
      });
      expect(resolveProblemShape(mode, 'hard')).toMatchObject({
        variableCount: 3,
        minOperatorCount: 2,
        maxOperatorCount: 4,
        requireInverseOrPower: true,
        forbidInverseOrPower: false,
        requireMixedRoles: true,
      });
    }

    expect(resolveProblemShape('predict-magnitude', 'easy').relativeChangeBand).toEqual({
      min: 0.45,
      max: Number.POSITIVE_INFINITY,
      target: 0.7,
    });
    expect(resolveProblemShape('predict-magnitude', 'medium').relativeChangeBand).toEqual({
      min: 0.2,
      max: 0.45,
      target: 0.325,
    });
    expect(resolveProblemShape('predict-magnitude', 'hard').relativeChangeBand).toEqual({
      min: 0.05,
      max: 0.2,
      target: 0.125,
    });
    expect(resolveProblemShape('predict-direction', 'hard').relativeChangeBand).toBeNull();
  });

  it('counts formula structure without treating unary or exponent signs as operations', () => {
    const easy = analyzeFormulaProblemShape('m * a', 2);
    const medium = analyzeFormulaProblemShape('F / m', 2);
    const hard = analyzeFormulaProblemShape('k * v ^ 2 / A', 3);
    const signedScientific = analyzeFormulaProblemShape('-1e-3 * a + b', 2);

    expect(easy).toMatchObject({ operatorCount: 1, operators: ['*'], hasInverseOrPower: false });
    expect(medium).toMatchObject({ operatorCount: 1, operators: ['/'], hasInverseOrPower: true });
    expect(hard).toMatchObject({ operatorCount: 3, operators: ['*', '^', '/'], hasInverseOrPower: true });
    expect(signedScientific).toMatchObject({ operatorCount: 2, operators: ['*', '+'] });
    expect(formulaMatchesProblemShape(easy, resolveProblemShape('free-explore', 'easy'))).toBe(true);
    expect(formulaMatchesProblemShape(medium, resolveProblemShape('free-explore', 'easy'))).toBe(false);
    expect(formulaMatchesProblemShape(medium, resolveProblemShape('predict-direction', 'medium'))).toBe(true);
    expect(formulaMatchesProblemShape(hard, resolveProblemShape('construct-formula', 'hard'))).toBe(true);
  });

  it('selects exact predict-magnitude bands and saturates to the nearest in-range candidate', () => {
    const pool = [candidate(0.8), candidate(0.34), candidate(0.12)];

    expect(selectStructuralCandidate(pool, 'predict-magnitude', 'easy')).toMatchObject({
      relativeChange: 0.8,
      saturated: false,
    });
    expect(selectStructuralCandidate(pool, 'predict-magnitude', 'medium')).toMatchObject({
      relativeChange: 0.34,
      saturated: false,
    });
    const hard = selectStructuralCandidate(pool, 'predict-magnitude', 'hard');
    expect(hard.relativeChange).toBeCloseTo(0.12, 10);
    expect(hard.saturated).toBe(false);
    const saturated = selectStructuralCandidate(
      [candidate(0.26), candidate(0.5)],
      'predict-magnitude',
      'hard',
    );
    expect(saturated.relativeChange).toBeCloseTo(0.26, 10);
    expect(saturated.saturated).toBe(true);
  });

  it('stress-tests 5,000 randomized candidate pools against exact-band and saturation invariants', () => {
    const tiers = ['easy', 'medium', 'hard'] as const;
    for (let run = 0; run < 5_000; run++) {
      const tier = tiers[run % tiers.length];
      const pool = Array.from({ length: 12 }, (_, index) => (
        candidate(0.001 + Math.random() * 1.999, index % 2 === 0 ? 'increase' : 'decrease')
      ));
      const band = resolveProblemShape('predict-magnitude', tier).relativeChangeBand!;
      const result = selectStructuralCandidate(pool, 'predict-magnitude', tier);
      expect(result.candidate).not.toBeNull();
      expect(result.relativeChange).not.toBeNull();

      const availableDistances = pool.map((item) => bandDistance(
        Math.abs(item.expectedTargetOutput - item.expectedBaselineOutput)
          / Math.max(1, Math.abs(item.expectedBaselineOutput)),
        band,
      ));
      const selectedDistance = bandDistance(result.relativeChange!, band);
      expect(selectedDistance).toBeCloseTo(Math.min(...availableDistances), 10);
      expect(result.saturated).toBe(selectedDistance > 1e-10);
    }
  });

  it('rebuilds answer-bearing challenges inside variable ranges and recomputes every answer', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const meanChanges: number[] = [];
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      const challenges = buildChallenges(wrapper, ['predict-magnitude'], tier);
      expect(challenges).toHaveLength(5);
      const relativeChanges: number[] = [];
      for (const challenge of challenges!) {
        const changedIndexes = challenge.baselineValues
          .map((value, index) => Math.abs(value - challenge.targetValues[index]) > 1e-9 ? index : -1)
          .filter((index) => index >= 0);
        expect(changedIndexes).toHaveLength(1);
        challenge.baselineValues.forEach((value, index) => {
          expect(value).toBeGreaterThanOrEqual(wrapper.variables[index].min);
          expect(value).toBeLessThanOrEqual(wrapper.variables[index].max);
          expect(challenge.targetValues[index]).toBeGreaterThanOrEqual(wrapper.variables[index].min);
          expect(challenge.targetValues[index]).toBeLessThanOrEqual(wrapper.variables[index].max);
        });
        const scope = (values: number[]) => Object.fromEntries(
          wrapper.variables.map((variable, index) => [variable.symbol, values[index]]),
        );
        expect(evaluateFormulaExpression(wrapper.expression, scope(challenge.baselineValues)))
          .toBeCloseTo(challenge.expectedBaselineOutput, 10);
        expect(evaluateFormulaExpression(wrapper.expression, scope(challenge.targetValues)))
          .toBeCloseTo(challenge.expectedTargetOutput, 10);
        relativeChanges.push(
          Math.abs(challenge.expectedTargetOutput - challenge.expectedBaselineOutput)
            / Math.max(1, Math.abs(challenge.expectedBaselineOutput)),
        );
      }
      meanChanges.push(relativeChanges.reduce((sum, value) => sum + value, 0) / relativeChanges.length);
    }
    expect(meanChanges[0]).toBeGreaterThan(meanChanges[1]);
    expect(meanChanges[1]).toBeGreaterThan(meanChanges[2]);
  });

  it('keeps fallback content pedagogically stable instead of replacing the topic to satisfy guidance', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const rangeSnapshots: unknown[] = [];
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      const fallback = buildFallback(['predict-magnitude'], tier);
      expect(fallback.expression).toBe('m * a');
      expect(fallback.variables).toHaveLength(2);
      expect(fallback.challenges).toHaveLength(5);
      expect(fallback.challenges.every((item) => item.type === 'predict-magnitude')).toBe(true);
      rangeSnapshots.push(fallback.variables.map(({ symbol, min, max, step }) => ({ symbol, min, max, step })));
    }
    expect(rangeSnapshots[1]).toEqual(rangeSnapshots[0]);
    expect(rangeSnapshots[2]).toEqual(rangeSnapshots[0]);
  });

  it('keeps the no-tier builder path free of structural metadata', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(Math, 'random').mockReturnValue(0.42);
    const challenges = buildChallenges(wrapper, ['predict-magnitude']);
    expect(challenges).toHaveLength(5);
    expect(challenges!.every((item) => item.supportTier === undefined)).toBe(true);
  });
});
