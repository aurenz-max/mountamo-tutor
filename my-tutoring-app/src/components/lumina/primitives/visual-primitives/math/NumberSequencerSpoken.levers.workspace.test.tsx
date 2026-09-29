// @vitest-environment jsdom
/**
 * The number-sequencer spoken-mode levers (handoff 23 step 2) on the shared teaching workspace, mounted the way a lesson
 * mounts it. A pull changes the train and the scene in one commit and states no answer; the next spoken attempt carries
 * the lever; the smaller train is ungraded, judged from speech and gives the full item back, which alone is credited.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('@/components/lumina/components/JudgedMicPanel', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).micPanelSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { observerLever } from '../../../components/live-activity/runtime/observerLever';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const data = (...challenges: Record<string, unknown>[]) => ({ title: 'Trains', gradeBand: '1', showNumberLine: false,
  showDotArrays: false, challenges });
const countFrom = { id: 'cf', type: 'count-from', instruction: '', sequence: [28], startNumber: 28, direction: 'forward',
  correctAnswers: [29, 30], rangeMin: 28, rangeMax: 30 };
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const cars = (h: WorkspaceHarness) => q(h, '[data-testid^="train-car-"]').map(c => c.querySelector('span')?.textContent);

it('count_from: step_arrow and car_marks mark printed cars only; the demand states no answer; the next try carries them', () => {
  const h = mountWorkspace({ primitiveId: 'number-sequencer', evalMode: 'count_from', data: data(countFrom), instanceId: 'train' });
  expect(levers(h)).toEqual([['step_arrow', false], ['car_marks', false], ['smaller_numbers', false]]);
  h.say('twenty-eight'); h.feedback('incorrect', 'retry');
  expect(observerLever(h.state(), true)).toBe('step_arrow');
  expect(h.dispatch('pull_lever', { lever: 'step_arrow' }).status).toBe('committed');
  const arrow = q(h, '[data-lever="step-arrow"]');
  expect(arrow).toHaveLength(1);
  expect(arrow[0].closest('[data-testid]')!.getAttribute('data-testid')).toBe('train-car-0');
  expect(arrow[0].textContent).toBe('+1 →');
  h.dispatch('pull_lever', { lever: 'car_marks' });
  // Marks on the printed 28 only: two sticks, eight dots; the empty cars carry none.
  const marks = q(h, '[data-lever="card-marks"]');
  expect(marks).toHaveLength(1);
  expect(marks[0].closest('[data-testid]')!.getAttribute('data-testid')).toBe('train-car-0');
  const demand = JSON.stringify(h.state().task!.demand);
  expect(String(h.state().task!.demand.onScreen)).toMatch(/marked one more.*sticks of ten/);
  expect(demand).not.toMatch(/\b29\b|twenty-nine/);
  h.say('twenty-nine'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['step_arrow', 'car_marks'] });
  h.close();
});

it('count_from: smaller_numbers is an ungraded train of the same shape, then the full item is credited', () => {
  const h = mountWorkspace({ primitiveId: 'number-sequencer', evalMode: 'count_from', data: data(countFrom), instanceId: 'train' });
  const full = h.state().task!.itemId;
  h.say('twenty-ten'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'smaller_numbers' });
  const task = h.state().task!;
  expect(task.itemId).toBe(`${full}~simpler`);
  expect(task.workspace!.practice).toEqual({ returnsTo: full });
  expect(task.workspace!.expectedAnswer).toBe('9');
  expect(cars(h)).toEqual(['8', '?']);
  h.say('nine'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe(full);
  expect(cars(h)).toEqual(['28', '?', '?']);
  h.say('twenty-nine'); h.feedback('correct');
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    [full, false, false], [`${full}~simpler`, true, true], [full, true, false]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: ['smaller_numbers'] });
  h.close();
});

it('spot_error: the model train circles its own wrong number and shares none with the item', () => {
  const spot = { id: 'sp', type: 'spot-error', instruction: '', sequence: [3, 4, 9, 6, 7], wrongIndex: 2, correctAnswers: [5],
    rangeMin: 3, rangeMax: 9 };
  const h = mountWorkspace({ primitiveId: 'number-sequencer', evalMode: 'spot_error', data: data(spot), instanceId: 'train' });
  expect(levers(h)).toEqual([['model_train', false]]);
  h.dispatch('pull_lever', { lever: 'model_train' });
  const model = q(h, '[data-lever="model-train"] span');
  const numbers = model.map(s => Number(s.textContent));
  expect(numbers.some(n => [3, 4, 9, 6, 7].includes(n))).toBe(false);
  expect(model.filter(s => s.getAttribute('data-model-wrong') === 'true').map(s => s.textContent)).toEqual(['39']);
  expect(cars(h)).toEqual(['3', '4', '9', '6', '7']);
  h.close();
});
