import { describe, expect, it } from 'vitest';
import {
  easierComparisonChoice,
  maxWorkableAngle,
  minimumPushSetting,
  requiredPushForce,
  selectMixedRampChallenges,
  selectRampChallenges,
  type CompareConditionsChallenge,
  type DesignWithBudgetChallenge,
  type RampChallengeMode,
} from './rampChallenges';

const ALL_MODES: RampChallengeMode[] = [
  'compare_conditions',
  'find_threshold',
  'design_with_budget',
];

describe('ramp challenge pool -- structure', () => {
  it('provides at least four challenges per task identity', () => {
    for (const mode of ALL_MODES) {
      expect(selectRampChallenges([mode], 99).length).toBeGreaterThanOrEqual(4);
    }
  });

  it('constrains pinned and blended selections to the requested modes', () => {
    const blend = selectRampChallenges(['compare_conditions', 'design_with_budget'], 99);
    expect(new Set(blend.map((challenge) => challenge.mode))).toEqual(
      new Set(['compare_conditions', 'design_with_budget']),
    );
  });

  it('covers all modes before repeating on the mixed path', () => {
    const mixed = selectMixedRampChallenges(6);
    expect(mixed).toHaveLength(6);
    expect(new Set(mixed.slice(0, 3).map((challenge) => challenge.mode))).toEqual(new Set(ALL_MODES));
    expect(new Set(mixed.map((challenge) => challenge.id)).size).toBe(mixed.length);
  });
});

describe('ramp challenge pool -- physics contract', () => {
  it('makes every comparison decisive and changes only the named variable', () => {
    const comparisons = selectRampChallenges(['compare_conditions'], 99) as CompareConditionsChallenge[];
    for (const challenge of comparisons) {
      expect(easierComparisonChoice(challenge)).not.toBe('same');
      const { a, b } = challenge.scenarios;
      if (challenge.changedVariable === 'angle') {
        expect(a.loadWeight).toBe(b.loadWeight);
        expect(a.frictionLevel).toBe(b.frictionLevel);
        expect(a.loadType).toBe(b.loadType);
        expect(a.angle).not.toBe(b.angle);
      }
      if (challenge.changedVariable === 'surface') {
        expect(a.loadWeight).toBe(b.loadWeight);
        expect(a.angle).toBe(b.angle);
        expect(a.loadType).toBe(b.loadType);
        expect(a.frictionLevel).not.toBe(b.frictionLevel);
      }
    }
  });

  it('find-threshold answers are the first slider step that moves', () => {
    const thresholdJobs = selectRampChallenges(['find_threshold'], 99);
    for (const challenge of thresholdJobs) {
      if (challenge.mode !== 'find_threshold') continue;
      const answer = minimumPushSetting(challenge.scenario, challenge.forceStep);
      expect(answer).toBeGreaterThan(requiredPushForce(challenge.scenario));
      expect(answer - challenge.forceStep).toBeLessThanOrEqual(requiredPushForce(challenge.scenario));
      expect(answer).toBeLessThanOrEqual(100);
    }
  });

  it('design jobs have one code-derived steepest whole-degree answer', () => {
    const designs = selectRampChallenges(['design_with_budget'], 99) as DesignWithBudgetChallenge[];
    for (const challenge of designs) {
      const answer = maxWorkableAngle(
        challenge.scenario,
        challenge.forceBudget,
        challenge.angleRange,
      );
      expect(challenge.forceBudget).toBeGreaterThan(
        requiredPushForce({ ...challenge.scenario, angle: answer }),
      );
      if (answer < challenge.angleRange.max) {
        expect(challenge.forceBudget).toBeLessThanOrEqual(
          requiredPushForce({ ...challenge.scenario, angle: answer + 1 }),
        );
      }
    }
  });
});

describe('ramp ladder -- catalog contract', () => {
  it('keeps catalog keys, pool modes, and beta ordering aligned', async () => {
    const { getComponentById } = await import('../../../service/manifest/catalog');
    const modes = getComponentById('ramp-lab')?.evalModes ?? [];
    expect(modes.map((mode) => mode.evalMode)).toEqual(ALL_MODES);
    expect(modes.map((mode) => mode.beta)).toEqual(
      [...modes.map((mode) => mode.beta)].sort((a, b) => a - b),
    );
    for (const mode of modes) {
      expect(selectRampChallenges(mode.challengeTypes, 99).length).toBeGreaterThanOrEqual(4);
    }
  });
});
