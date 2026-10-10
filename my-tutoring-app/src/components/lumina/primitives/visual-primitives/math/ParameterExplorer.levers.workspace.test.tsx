// @vitest-environment jsdom
/**
 * parameter-explorer's levers on the teaching workspace: a pull changes the screen and the scene in the same commit,
 * draws no key, is recorded on the next attempt; the simpler problem is ungraded practice and the full item comes back.
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
import type { ParameterExplorerChallenge, ParameterExplorerData } from './ParameterExplorer';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const write = (h: WorkspaceHarness, label: string, text: string) => act(() => {
  fireEvent.change(h.view.container.querySelector(`input[aria-label="${label}"]`)!, { target: { value: text } });
});
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const snapshot = (h: WorkspaceHarness) => ({ demand: JSON.stringify(h.state().task!.demand), levers: levers(h),
  attempts: attempts(h).length, html: h.view.container.innerHTML });
const choose = (h: WorkspaceHarness, label: string) => { h.press(label); h.press('Check Answer'); };

/** a = F / m: F only multiplies, m divides. */
const motion = (c: ParameterExplorerChallenge): ParameterExplorerData => ({
  title: 'Acceleration', formula: 'a = \\frac{F}{m}', jsExpression: 'F / m', outputName: 'Acceleration', outputUnit: 'm/s²',
  context: 'A cart.', challenges: [c],
  parameters: [
    { symbol: 'F', name: 'Net force', unit: 'N', min: 1, max: 100, step: 1, default: 20, description: '' },
    { symbol: 'm', name: 'Mass', unit: 'kg', min: 1, max: 50, step: 1, default: 5, description: '' },
  ],
});
/** KE = ½ m v²: v leads; m has the larger starting number. */
const energy = (c: ParameterExplorerChallenge): ParameterExplorerData => ({
  title: 'Energy', formula: 'KE = \\frac{1}{2}mv^2', jsExpression: '0.5 * m * Math.pow(v, 2)', outputName: 'Kinetic Energy',
  outputUnit: 'J', context: 'A cart.', challenges: [c],
  parameters: [
    { symbol: 'm', name: 'Mass', unit: 'kg', min: 1, max: 100, step: 1, default: 10, description: '' },
    { symbol: 'v', name: 'Velocity', unit: 'm/s', min: 0, max: 20, step: 0.5, default: 5, description: '' },
  ],
});
const mount = (d: ParameterExplorerData) => {
  const h = mountWorkspace({ primitiveId: 'parameter-explorer', evalMode: d.challenges[0].type, data: d as unknown as Record<string, unknown> });
  h.settle(2000);
  return h;
};
const direction: ParameterExplorerChallenge = { id: 'd1', type: 'predict-direction', instruction: '',
  prediction: { varyParameter: 'm', newValue: 10, correctDirection: 'decrease', explanation: '' } };

it('predict-direction: the ring and the model pair draw in the same commit with no direction word; the next attempt records them; a repeat pull changes nothing', () => {
  const h = mount(motion(direction));
  expect(levers(h)).toEqual([['find_parameter', false], ['model_pair', false], ['simpler_problem', false]]);
  choose(h, 'Increase');
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'opposite_direction' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'opposite_direction')).toBe('find_parameter');
  const receipt = h.dispatch('pull_lever', { lever: 'find_parameter' });
  expect(receipt.status).toBe('committed');
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/ringed/);
  const ring = q(h, '[data-lever="find-parameter"]')[0];
  expect(ring.textContent).toBe('a = F ÷ m');
  expect(Array.from(ring.querySelectorAll('.rounded-full')).map(e => e.textContent)).toEqual(['m']);
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'find_parameter' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(before);
  expect(h.dispatch('pull_lever', { lever: 'model_pair' }).status).toBe('committed');
  expect(q(h, '[data-lever="model-pair"]')[0].textContent).toMatch(/y = 42 × x: x 6 → 7, y 252 → 294.*y = 42 ÷ x: x 6 → 7, y 7 → 6/);
  expect(h.view.container.textContent).not.toMatch(/increases|decreases|gets (bigger|smaller)/i);
  expect(q(h, '[data-output]')[0].getAttribute('data-output')).toBe('hidden');
  h.dispatch('retry');
  choose(h, 'Decrease');
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'd1', correct: true, levers: ['find_parameter', 'model_pair'] });
});

it('the simpler problem is ungraded practice on the parameter that only multiplies; the full item comes back blank and is credited after', () => {
  const h = mount(motion(direction));
  choose(h, 'Increase');
  const r = h.dispatch('pull_lever', { lever: 'simpler_problem' });
  expect(r.status).toBe('committed');
  expect(r.state.task!.itemId).toBe('d1~simpler');
  expect(r.state.task!.workspace!.practice).toEqual({ returnsTo: 'd1' });
  expect(String(r.state.task!.task)).toMatch(/^Net force \(F\) changes from 20 N to 40 N while m = 5 kg stays fixed/);
  choose(h, 'Increase');
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('d1');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'no direction chosen yet', sliders: 'F 20 N, m 5 kg' });
  choose(h, 'Decrease');
  expect(attempts(h).map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['d1', false, false], ['d1~simpler', true, true], ['d1', true, false]]);
});

it('predict-value: the substitution writes the setting in without the answer; the output stays hidden', () => {
  const h = mount(energy({ id: 'v1', type: 'predict-value', instruction: '',
    prediction: { varyParameter: 'v', newValue: 10, correctValue: 500, tolerance: 1, explanation: '' } }));
  write(h, 'Your prediction', '250'); h.press('Check Answer');
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'assumed_proportional' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'assumed_proportional')).toBe('substitution');
  for (const id of ['substitution', 'scaling_model']) expect(h.dispatch('pull_lever', { lever: id }).status).toBe('committed');
  expect(q(h, '[data-lever="substitution"]')[0].textContent).toBe('KE = 0.5 × 10 × 10^2');
  expect(q(h, '[data-lever="scaling-model"]')[0].textContent).toMatch(/× x²/);
  expect(h.view.container.textContent).not.toMatch(/\b500\b/);
  expect(q(h, '[data-output]')[0].getAttribute('data-output')).toBe('hidden');
  h.dispatch('retry');
  write(h, 'Your prediction', '500'); h.press('Check Answer');
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, levers: ['substitution', 'scaling_model'] });
});

it('identify: the doubling marks and Back to start let the learner test; nothing names the leader', () => {
  const h = mount(energy({ id: 'i1', type: 'identify-relationship', instruction: '', correctParameter: 'v' }));
  choose(h, 'm (Mass)');
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'largest_value' });
  for (const id of ['double_marks', 'doubling_model']) expect(h.dispatch('pull_lever', { lever: id }).status).toBe('committed');
  expect(q(h, '[data-lever="double-marks"]')).toHaveLength(2);
  expect(q(h, '[data-lever="doubling-model"]')[0].textContent).toMatch(/y = 2 × x²/);
  expect(h.view.container.textContent).not.toMatch(/Velocity leads|v leads|375/);
  h.dispatch('retry');
  // The doubling test: v to its double, the readout moves; Back to start puts it back.
  write(h, 'Velocity (v) slider', '10');
  expect(h.state().task!.demand.outputShown).toMatch(/Kinetic Energy 500 J/);
  h.press('Back to start');
  expect(h.state().task!.demand.outputShown).toMatch(/Kinetic Energy 125 J/);
  choose(h, 'v (Velocity)');
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, levers: ['double_marks', 'doubling_model'] });
});

it('explore declares no lever', () => {
  const h = mount(motion({ id: 'e1', type: 'explore', instruction: 'Move the sliders.' }));
  expect(levers(h)).toEqual([]);
});
