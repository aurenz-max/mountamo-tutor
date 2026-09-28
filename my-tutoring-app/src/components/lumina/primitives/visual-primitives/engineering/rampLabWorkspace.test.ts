import { expect, it } from 'vitest';
import { rampMiss } from './rampLabWorkspace';
import { maxWorkableAngle, minimumPushSetting, type RampChallenge, type RampScenario } from './rampChallenges';

const setup = (angle: number, loadWeight: number, frictionLevel: RampScenario['frictionLevel'] = 'medium'): RampScenario =>
  ({ label: '', angle, loadWeight, loadType: 'box', frictionLevel });
const base = { id: 'r', title: '', brief: '', hint: '', explainOnSolve: '' };
// A steep and a gentle ramp: B needs less push. Then two identical ones: the same push.
const steeper = { ...base, mode: 'compare_conditions', changedVariable: 'angle', scenarios: { a: setup(42, 5), b: setup(20, 5) } } as RampChallenge;
const equal = { ...base, mode: 'compare_conditions', changedVariable: 'angle', scenarios: { a: setup(20, 5), b: setup(20, 5) } } as RampChallenge;
const threshold = { ...base, mode: 'find_threshold', scenario: setup(20, 5), forceStep: 0.5 } as RampChallenge;
const push = minimumPushSetting(setup(20, 5), 0.5);
const budget = { ...base, mode: 'design_with_budget', scenario: setup(30, 5), forceBudget: 30, angleRange: { min: 10, max: 50 }, targetHeight: 3 } as RampChallenge;
const angle = maxWorkableAngle(setup(30, 5), 30, { min: 10, max: 50 });
const plan = { ...base, mode: 'plan_fair_test', variable: 'angle', scenarios: { a: setup(20, 5), b: setup(20, 5) } } as RampChallenge;

it.each([
  [steeper, { choice: 'b' }, undefined], [steeper, { choice: 'a' }, 'harder_setup'], [steeper, { choice: 'same' }, 'same_for_different'],
  [equal, { choice: 'same' }, undefined], [equal, { choice: 'a' }, 'one_for_same'],
  [threshold, { push }, undefined], [threshold, { push: push - 0.5 }, 'load_did_not_move'], [threshold, { push: push + 1 }, 'more_than_minimum'],
  [budget, { angle }, undefined], [budget, { angle: angle + 1 }, 'over_budget'], [budget, { angle: angle - 3 }, 'not_steepest'],
  [plan, { planB: setup(30, 5) }, undefined], [plan, { planB: setup(20, 5) }, 'nothing_changed'],
  [plan, { planB: setup(20, 8) }, 'other_condition'], [plan, { planB: setup(30, 5, 'high') }, 'extra_condition'],
  [plan, { planB: { ...setup(30, 5), loadType: 'barrel' } }, 'extra_condition'],
] as const)('row %#', (c, work, miss) => {
  expect(rampMiss(c, work as Parameters<typeof rampMiss>[1])).toBe(miss);
});
