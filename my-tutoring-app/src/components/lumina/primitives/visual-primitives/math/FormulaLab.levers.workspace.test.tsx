// @vitest-environment jsdom
/**
 * formula-lab levers on the teaching workspace: a pull changes the screen and the scene fact in the same commit, the
 * next attempt records it, a refused pull changes nothing, and the easier problem is ungraded practice with the full
 * item back after it.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { FormulaLabChallenge, FormulaLabChallengeType, FormulaLabData } from './FormulaLab';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const write = (h: WorkspaceHarness, label: string, text: string) => act(() => {
  fireEvent.change(h.view.container.querySelector(`input[aria-label="${label}"]`)!, { target: { value: text } });
});
const predict = (h: WorkspaceHarness, percent: number) => { write(h, 'Your prediction', String(percent)); h.press('Lock prediction'); };
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const snapshot = (h: WorkspaceHarness) => ({ demand: JSON.stringify(h.state().task!.demand), levers: levers(h),
  attempts: attempts(h).length, html: h.view.container.innerHTML });

/** kinetic energy: m only multiplies, v is squared. */
const item = (type: FormulaLabChallengeType, changed: 'm' | 'v', base: [number, number], target: [number, number]): FormulaLabChallenge => {
  const e = ([m, v]: [number, number]) => 0.5 * m * v * v;
  return { id: `${type}-1`, type, changedVariableSymbol: changed, baselineValues: base, targetValues: target,
    expectedBaselineOutput: e(base), expectedTargetOutput: e(target), correctDirection: e(target) > e(base) ? 'increase' : 'decrease' };
};
const lab = (c: FormulaLabChallenge): FormulaLabData => ({
  title: 'Energy', description: '', context: 'A cart rolls.', transferContext: 'A heavier cart.', formulaLatex: 'E = \\frac{1}{2} m v^2',
  expression: '0.5 * m * v ^ 2', outputSymbol: 'E', outputName: 'energy', outputUnit: 'J', sceneKind: 'motion', challengeType: c.type,
  gradeBand: 'Grade 8', challenges: [c],
  variables: [
    { symbol: 'm', name: 'mass', unit: 'kg', min: 1, max: 50, step: 1, defaultValue: 10, accent: 'cyan' },
    { symbol: 'v', name: 'speed', unit: 'm/s', min: 1, max: 20, step: 1, defaultValue: 4, accent: 'amber' },
  ],
});
const mount = (c: FormulaLabChallenge) => {
  const h = mountWorkspace({ primitiveId: 'formula-lab', evalMode: c.type, data: lab(c) as unknown as Record<string, unknown> });
  h.settle(2000);
  return h;
};

it('predict-direction: the symbol is ringed in the same commit, with no direction word; the next attempt records the lever; a repeat pull changes nothing', () => {
  const h = mount(item('predict-direction', 'v', [10, 8], [10, 4]));
  expect(levers(h)).toEqual([['find_quantity', false], ['model_pair', false], ['simpler_problem', false]]);
  predict(h, 60);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'opposite_direction' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'opposite_direction')).toBe('find_quantity');
  const receipt = h.dispatch('pull_lever', { lever: 'find_quantity' });
  expect(receipt.status).toBe('committed');
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/ringed/);
  const ring = q(h, '[data-lever="find-quantity"]')[0];
  expect(ring.textContent).toBe('E = 0.5×m×v^2');
  expect(ring.querySelectorAll('.rounded-full')).toHaveLength(1);
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'find_quantity' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(before);
  expect(h.dispatch('pull_lever', { lever: 'model_pair' }).status).toBe('committed');
  expect(q(h, '[data-lever="model-pair"]')[0].textContent).toMatch(/y = 6 × x: x 2 → 3, y 12 → 18.*y = 6 ÷ x: x 2 → 3, y 3 → 2/);
  expect(h.view.container.textContent).toMatch(/Output hidden/);
  h.dispatch('retry');
  predict(h, -60);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'predict-direction-1', correct: true, levers: ['find_quantity', 'model_pair'] });
});

it('predict-magnitude: the track is labelled in words only', () => {
  const h = mount(item('predict-magnitude', 'm', [10, 4], [20, 4]));
  predict(h, 30);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'too_weak' });
  expect(h.dispatch('pull_lever', { lever: 'track_scale' }).status).toBe('committed');
  expect(q(h, '[data-lever="track-scale"]')[0].textContent).toBe('drops to zerohalvesno changehalf as much againdoubles');
  h.dispatch('retry');
  predict(h, 100);
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, levers: ['track_scale'] });
});

it('the simpler problem is ungraded practice on the quantity that only multiplies; the full item comes back blank and is credited after', () => {
  const h = mount(item('predict-direction', 'v', [10, 8], [10, 4]));
  predict(h, 60);
  const r = h.dispatch('pull_lever', { lever: 'simpler_problem' });
  expect(r.status).toBe('committed');
  expect(r.state.task!.itemId).toBe('predict-direction-1~simpler');
  expect(r.state.task!.workspace!.practice).toEqual({ returnsTo: 'predict-direction-1' });
  expect(r.state.task!.demand).toMatchObject({ changes: 'mass from 10 to 20 kg', learnerWork: 'no prediction placed yet' });
  predict(h, 60);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('predict-direction-1');
  expect(h.state().task!.demand).toMatchObject({ changes: 'speed from 8 to 4 m/s', learnerWork: 'no prediction placed yet' });
  predict(h, -60);
  expect(attempts(h).map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['predict-direction-1', false, false], ['predict-direction-1~simpler', true, true], ['predict-direction-1', true, false]]);
});

it('construct: the tokens group, the value check updates with the build, and no lever shows the order', () => {
  const h = mount(item('construct-formula', 'm', [10, 3], [20, 3]));
  for (const t of ['2', '^', 'v', '*', 'm', '*', '0.5']) h.press(t);
  h.press('Check formula');
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'operation_order' });
  for (const id of ['group_tokens', 'value_check', 'order_card']) expect(h.dispatch('pull_lever', { lever: id }).status).toBe('committed');
  expect(q(h, '[data-lever="value-check"]')[0].textContent).toMatch(/your build gives 40.*the living system gives 45/);
  expect(q(h, '[data-lever="order-card"]')[0].textContent).toMatch(/x \^ 2 means x × x/);
  expect(h.view.container.textContent).not.toMatch(/0\.5 \* m \* v|m \* v \^ 2|v \^ 2/);
  h.dispatch('retry');
  expect(h.view.container.textContent).toMatch(/Variables & values/);
  expect(q(h, '[data-lever="value-check"]')[0].textContent).toMatch(/no value yet/);
  for (const t of ['0.5', '*', 'm', '*', 'v', '^', '2']) h.press(t);
  h.press('Check formula');
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, levers: ['group_tokens', 'value_check', 'order_card'] });
});

it('transfer: the substitution and the new inputs draw without the answer; the output stays hidden', () => {
  const h = mount(item('transfer-apply', 'm', [10, 4], [30, 6]));
  write(h, 'Transferred output', '80'); h.press('Check transferred output');
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'used_starting_inputs' });
  for (const id of ['substitution', 'new_inputs', 'order_card']) expect(h.dispatch('pull_lever', { lever: id }).status).toBe('committed');
  expect(h.view.container.textContent).toMatch(/E = 0\.5 × 30 × 6 \^ 2/);
  expect(h.view.container.textContent).toMatch(/Output hidden/);
  expect(h.view.container.textContent).not.toMatch(/\b540\b/);
  h.dispatch('retry');
  write(h, 'Transferred output', '540'); h.press('Check transferred output');
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, levers: ['substitution', 'new_inputs', 'order_card'] });
});

it('free-explore declares no lever', () => {
  const h = mount(item('free-explore', 'm', [10, 4], [20, 4]));
  expect(levers(h)).toEqual([]);
});
