import { describe, expect, it } from 'vitest';
import { isFairRampTest, measureRampTrial, requiredPushForce, selectRampChallenges, type RampInvestigationChallenge } from './rampChallenges';
import { rampExplanationPack } from './rampExplanationScript';
import { validateJudgedScriptPack } from '../../../hooks/judgedScriptContract';

const jobs = selectRampChallenges(['explain_from_trials'], 99) as RampInvestigationChallenge[];
describe('ramp investigation evidence contract', () => {
  it('rejects unchanged, wrong-variable and confounded comparisons', () => {
    const a = jobs[0].scenarios.a;
    expect(isFairRampTest('surface', a, a)).toBe(false);
    expect(isFairRampTest('surface', a, { ...a, angle: 35 })).toBe(false);
    expect(isFairRampTest('surface', a, { ...a, frictionLevel: 'high', angle: 35 })).toBe(false);
    expect(isFairRampTest('surface', a, { ...a, frictionLevel: 'high', loadType: 'wheel' })).toBe(false);
    expect(isFairRampTest('surface', a, { ...a, frictionLevel: 'high' })).toBe(true);
  });
  it('provides every variable and both comparison directions with physical evidence', () => {
    expect(new Set(jobs.map(j => j.variable))).toEqual(new Set(['surface', 'angle', 'mass']));
    const directions = new Set<string>();
    for (const job of jobs) {
      expect(isFairRampTest(job.variable, job.scenarios.a, job.scenarios.b)).toBe(true);
      const trials = [measureRampTrial('a', job.scenarios.a), measureRampTrial('b', job.scenarios.b)];
      for (const trial of trials) {
        // Independently calculate the continuous force threshold.
        const radians = trial.scenario.angle * Math.PI / 180;
        const coefficient = { none: 0, low: 0.1, medium: 0.3, high: 0.5 }[trial.scenario.frictionLevel];
        const force = trial.scenario.loadWeight * 9.8 * (Math.sin(radians) + coefficient * Math.cos(radians));
        expect(trial.firstMovingForce).toBeGreaterThan(force);
        expect(trial.lastStillForce).toBeLessThanOrEqual(force);
      }
      directions.add(trials[0].firstMovingForce < trials[1].firstMovingForce ? 'a' : 'b');
      const pack = rampExplanationPack(job, trials);
      expect(validateJudgedScriptPack(pack)).toEqual([]);
      expect(pack.items).toHaveLength(1);
      expect(pack.pronounceCue!(pack.items[0])).not.toContain('needed less push');
    }
    expect(directions).toEqual(new Set(['a', 'b']));
  });
  it('refuses missing or corrupted observations instead of inventing evidence', () => {
    const job = jobs[0], a = measureRampTrial('a', job.scenarios.a), b = measureRampTrial('b', job.scenarios.b);
    expect(rampExplanationPack(job, [a]).items).toHaveLength(0);
    expect(rampExplanationPack(job, [a, { ...b, firstMovingForce: 999 }]).items).toHaveLength(0);
    expect(rampExplanationPack(job, [a, a]).items).toHaveLength(0);
    const oldMass = a.scenario.loadWeight;
    job.scenarios.a.loadWeight += 1;
    expect(a.scenario.loadWeight).toBe(oldMass);
    job.scenarios.a.loadWeight -= 1;
    expect(a.firstMovingForce).toBeGreaterThan(requiredPushForce(a.scenario));
  });
  it('blends both new modes even when count is smaller than either pool', () => {
    const blend = selectRampChallenges(['plan_fair_test', 'explain_from_trials'], 4);
    expect(blend.map(j => j.mode)).toEqual(['plan_fair_test', 'explain_from_trials', 'plan_fair_test', 'explain_from_trials']);
    expect(selectRampChallenges(['made_up'], 4)).toEqual([]);
  });
});
