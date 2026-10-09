// @vitest-environment jsdom
/**
 * function-machine levers on the teaching workspace: a pull changes the screen and the scene fact in the same commit,
 * the next attempt records it, a refused pull changes nothing, and the practice machine is ungraded with the full
 * item back after it.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { FunctionMachineChallenge, FunctionMachineChallengeType } from './FunctionMachine';
import { ruleTiles } from './functionMachineWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const write = (h: WorkspaceHarness, label: string, text: string) => act(() => {
  fireEvent.change(h.view.container.querySelector(`input[aria-label="${label}"]`)!, { target: { value: text } });
});
const predict = (h: WorkspaceHarness, x: number, value: number) => { write(h, 'My prediction', String(value)); h.press(`Feed ${x}`); };
const tiles = (h: WorkspaceHarness, rule: string) => ruleTiles(rule).forEach(t => h.press(`Add ${t}`));
const q = (h: WorkspaceHarness, sel: string) => h.view.container.querySelector(sel);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const snapshot = (h: WorkspaceHarness) => ({ demand: JSON.stringify(h.state().task!.demand), levers: levers(h),
  attempts: attempts(h).length, html: h.view.container.innerHTML });
const mount = (mode: FunctionMachineChallengeType, challenges: FunctionMachineChallenge[]) => mountWorkspace({ primitiveId: 'function-machine',
  evalMode: mode, data: { title: 'Machines', description: '', challengeType: mode, challenges } as unknown as Record<string, unknown> });

it('predict: the model machine draws in the same commit with none of the item\'s outputs; the next attempt records it; a repeat pull changes nothing', () => {
  const h = mount('predict', [{ id: 'p', rule: '4*x', inputQueue: [2, 3], showRule: true }]);
  expect(levers(h)).toEqual([['model_machine', false], ['simpler_machine', false]]);
  predict(h, 2, 6);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'added_not_multiplied' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'added_not_multiplied')).toBe('model_machine');
  const r = h.dispatch('pull_lever', { lever: 'model_machine' });
  expect(r.status).toBe('committed');
  expect(String(r.state.task!.demand.onScreen)).toMatch(/different machine of the same kind: f\(x\) = \dx: /);
  const card = q(h, '[data-lever="model-machine"]')!.textContent!;
  expect(card).toMatch(/A different machine/);
  expect(card).not.toMatch(/\b8\b|\b12\b/);
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'model_machine' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(before);
  h.dispatch('retry');
  predict(h, 2, 8); predict(h, 3, 12);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'p', correct: true, levers: ['model_machine'] });
});

it('predict: step_order redraws a two-step rule as its steps, in place of the rule', () => {
  const h = mount('predict', [{ id: 'p', rule: '2*x + 1', inputQueue: [2, 3], showRule: true }]);
  predict(h, 2, 4);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'one_step_only' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'one_step_only')).toBe('model_machine');
  expect(h.dispatch('pull_lever', { lever: 'step_order' }).status).toBe('committed');
  expect(q(h, '[data-lever="step-order"]')!.textContent).toBe('first × 2then + 1');
  expect(h.view.container.textContent).not.toMatch(/f\(x\) = 2\*x \+ 1/);
  expect(String(h.state().task!.demand.onScreen)).toBe('The rule on the machine is drawn as two steps in order: first × 2, then + 1.');
});

it('discover: check_pairs is refused before a checked rule; after a miss it marks the learner\'s rule on each pair, and output_steps marks the changes', () => {
  const h = mount('discover_rule', [{ id: 'd', rule: '2*x + 1', inputQueue: [0, 1, 2, 3], showRule: false }]);
  h.press('Feed 0'); h.press('Feed 1');
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'check_pairs' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(before);
  write(h, 'Your rule', 'x + 1'); h.press('Check');
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'fits_some_pairs' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'fits_some_pairs')).toBe('check_pairs');
  expect(h.dispatch('pull_lever', { lever: 'check_pairs' }).status).toBe('committed');
  expect(h.dispatch('pull_lever', { lever: 'output_steps' }).status).toBe('committed');
  expect(q(h, '[data-lever="check-pairs"]')!.textContent).toMatch(/x \+ 1 on each pair:0 → 1 ✓1 → 3 ✗/);
  expect(q(h, '[data-lever="output-steps"]')!.textContent).toMatch(/0 to 1: \+2/);
  expect(h.view.container.textContent).not.toMatch(/2\s*\*\s*x/);
  // Try again clears the box; the marks stay on the rule that was checked.
  h.dispatch('retry');
  expect(q(h, '[data-lever="check-pairs"]')!.textContent).toMatch(/x \+ 1 on each pair/);
  write(h, 'Your rule', '2x + 1'); h.press('Check');
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, levers: ['check_pairs', 'output_steps'] });
});

it('discover: the practice machine is ungraded and one step; the full item comes back blank and is credited after', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('discover_rule', [{ id: 'd', rule: 'x + 5', inputQueue: [0, 1, 2, 3], showRule: false }]);
  h.press('Feed 0'); h.press('Feed 1');
  write(h, 'Your rule', '5*x'); h.press('Check');
  const r = h.dispatch('pull_lever', { lever: 'simpler_machine' });
  expect(r.status).toBe('committed');
  expect(r.state.task!.itemId).toBe('d~simpler');
  expect(r.state.task!.demand).toMatchObject({ pairsOnScreen: 'none yet', inputsToFeed: '0, 1, 2, 3' });
  expect(h.view.container.querySelector('[data-practice]')).not.toBeNull();
  h.press('Feed 0'); h.press('Feed 1');
  write(h, 'Your rule', 'x + 2'); h.press('Check');
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  expect(h.view.container.textContent).not.toMatch(/Complete!/);
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('d');
  expect(h.state().task!.demand).toMatchObject({ pairsOnScreen: 'none yet', learnerWork: 'No rule typed yet' });
  h.press('Feed 0'); h.press('Feed 1');
  write(h, 'Your rule', 'x + 5'); h.press('Check');
  expect(attempts(h).map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['d', false, false], ['d~simpler', true, true], ['d', true, false]]);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
});

it('make: run_machine works the learner\'s own machine through; shapes write no number; the stored machine never shows', () => {
  const h = mount('make_rule', [{ id: 'm', rule: '3*x', inputQueue: [4], showRule: false, makeInput: 4, makeOutput: 12 }]);
  expect(h.dispatch('pull_lever', { lever: 'run_machine' }).status).toBe('blocked');
  tiles(h, 'x+9'); h.press("I'm done!");
  expect(nextLever(h.state().task!.workspace!.levers!, 'wrong_output')).toBe('run_machine');
  expect(h.dispatch('pull_lever', { lever: 'run_machine' }).status).toBe('committed');
  expect(h.dispatch('pull_lever', { lever: 'machine_shapes' }).status).toBe('committed');
  expect(q(h, '[data-lever="run-machine"]')!.textContent).toMatch(/x \+ 9, worked through:4 \+ 9 = 135 \+ 9 = 14/);
  expect(q(h, '[data-lever="machine-shapes"]')!.textContent).not.toMatch(/\d/);
  expect(h.view.container.textContent).not.toMatch(/3x|3 × x|x \+ 8/);
  h.dispatch('retry');
  h.press('Start over'); tiles(h, 'x+8'); h.press("I'm done!"); tiles(h, '3*x'); h.press("I'm done!");
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, levers: ['run_machine', 'machine_shapes'] });
});

it('make: the practice machine asks for a smaller pair, never the item\'s', () => {
  const h = mount('make_rule', [{ id: 'm', rule: '5*x', inputQueue: [4], showRule: false, makeInput: 4, makeOutput: 20 }]);
  tiles(h, 'x+17'); h.press("I'm done!");
  const r = h.dispatch('pull_lever', { lever: 'simpler_machine' });
  expect(r.status).toBe('committed');
  expect(r.state.task!.task).toBe('Make a machine that turns 2 into 4. Then make a different machine that also turns 2 into 4.');
  tiles(h, '2*x'); h.press("I'm done!"); tiles(h, 'x+2'); h.press("I'm done!");
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('m');
  expect(String(h.state().task!.demand.learnerWork)).toBe('The machine row is empty');
});
