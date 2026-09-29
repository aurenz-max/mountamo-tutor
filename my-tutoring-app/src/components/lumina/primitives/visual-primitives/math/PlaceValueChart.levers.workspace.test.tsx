// @vitest-environment jsdom
/**
 * The place-value-chart build levers on the shared teaching workspace (handoff 21 M1), mounted the way a lesson
 * mounts it. A pull changes the chart area in the same commit and never shows the dictated number; the plainer
 * dictation is ungraded practice that returns to the full item, credited with its lever.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('@/components/lumina/components/JudgedMicPanel', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).micPanelSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { itemsFromChallenges } from './placeValueScript';
import { plainNumber } from './placeValueLevers';

const buildItem = (targetNumber: number) => itemsFromChallenges([{ id: 'p1', targetNumber, highlightedDigitPlace: 0, minPlace: 0,
  maxPlace: String(targetNumber).length - 1 } as never], { mode: 'build', tier: 'medium' }).items.find(i => i.kind === 'build_number')!;

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const data = (show: boolean) => ({ title: 'Place value', description: '', challengeType: 'build', supportTier: 'medium',
  showMultipliers: show, showExpandedForm: show,
  challenges: [{ id: 'p1', targetNumber: 406, highlightedDigitPlace: 0, minPlace: 0, maxPlace: 2 }] });
const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers ?? [];
/** Write one digit per column, HIGH to LOW ('' leaves a column empty), then let the chart settle and commit. */
const write = (h: WorkspaceHarness, ...digits: string[]) => {
  const inputs = Array.from(h.view.container.querySelectorAll('input'));
  digits.forEach((d, i) => act(() => { fireEvent.change(inputs[i], { target: { value: d } }); }));
  h.settle(5000);
};

it('model_chart shows the model number beside the chart in the same commit; the dictated number is never drawn', () => {
  const h = mountWorkspace({ primitiveId: 'place-value-chart', evalMode: 'build', data: data(false), instanceId: 'chart' });
  h.settle();
  expect(levers(h).map(l => [l.id, l.kind, l.pulled])).toEqual([['model_chart', 'help', false], ['column_worth', 'help', false],
    ['expanded_readback', 'help', false], ['model_teen', 'help', false], ['plain_number', 'simplify', false]]);
  write(h, '4', '', '6');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'zero_left_empty' });
  h.dispatch('pull_lever', { lever: 'model_chart' });
  const model = h.view.container.querySelector('[data-lever="model-chart"]');
  expect(model).toBeTruthy();
  expect(model!.querySelectorAll('input')).toHaveLength(0);
  expect(model!.textContent).not.toMatch(/406/);
  expect(h.state().task!.demand.onScreen).toMatch(/model chart/);
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/406/);
  h.dispatch('retry'); h.settle();
  write(h, '4', '0', '6');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['model_chart'] });
  h.close();
});

it('column_worth and expanded_readback are the tier flags as levers: off, then shown by a pull', () => {
  const h = mountWorkspace({ primitiveId: 'place-value-chart', evalMode: 'build', data: data(false), instanceId: 'chart' });
  h.settle();
  expect(h.view.container.querySelector('[data-lever="column-worth"]')).toBeNull();
  h.dispatch('pull_lever', { lever: 'column_worth' });
  expect(h.view.container.querySelector('[data-lever="column-worth"]')).toBeTruthy();
  h.close();
  const on = mountWorkspace({ primitiveId: 'place-value-chart', evalMode: 'build', data: data(true), instanceId: 'chart2' });
  on.settle();
  expect(levers(on).filter(l => l.pulled).map(l => l.id)).toEqual(['column_worth', 'expanded_readback']);
  expect(on.view.container.querySelector('[data-lever="column-worth"]')).toBeTruthy();
  on.close();
});

it('the plainer dictation is ungraded practice, then the full number is credited with its lever', () => {
  const h = mountWorkspace({ primitiveId: 'place-value-chart', evalMode: 'build', data: data(true), instanceId: 'chart' });
  h.settle();
  const full = h.state().task!.itemId;
  write(h, '4', '6', '');
  h.dispatch('pull_lever', { lever: 'plain_number' });
  const practice = h.state().task!.itemId;
  expect(practice).toMatch(/~plain/);
  expect(practice).not.toBe(full);
  expect(h.state().task!.workspace!.practice).toEqual({ returnsTo: full });
  expect(h.view.container.querySelectorAll('input')[0].value).toBe('');
  // The same number the lever builds: same places, no zero, no teen, no digit shared with 406.
  const plain = String(plainNumber(buildItem(406), new Set([406])));
  write(h, ...plain.split(''));
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance'); h.settle();
  expect(h.state().task!.itemId).toBe(full);
  write(h, '4', '0', '6');
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    [full, false, false], [practice, true, true], [full, true, false]]);
  expect(attempts.at(-1)).toMatchObject({ levers: ['plain_number'], assisted: true });
  h.close();
});

// ── say_value (spoken slice): the levers act beside the printed number; find_place has none ──

const identify = () => ({ title: 'Place value', description: '', challengeType: 'identify', supportTier: 'medium',
  challenges: [{ id: 'p1', targetNumber: 415, highlightedDigitPlace: 2, minPlace: 0, maxPlace: 2 }] });

it('say_value: the block picture and the model sit beside the number in one commit; neither says the worth asked', () => {
  const h = mountWorkspace({ primitiveId: 'place-value-chart', evalMode: 'identify', data: identify(), instanceId: 'chart' });
  h.settle();
  expect(h.state().task!.itemId).toMatch(/::place$/);
  expect(levers(h)).toEqual([]);
  h.say('the hundreds'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toMatch(/::value$/);
  expect(levers(h).map(l => [l.id, l.kind])).toEqual([['model_value', 'help'], ['block_picture', 'help']]);
  h.say('four'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'block_picture' });
  const blocks = h.view.container.querySelectorAll('[data-lever="block-picture"] span');
  expect(blocks).toHaveLength(4);
  expect(h.view.container.querySelector('[data-lever="block-picture"]')!.textContent).toBe('');
  h.dispatch('pull_lever', { lever: 'model_value' });
  const model = h.view.container.querySelector('[data-lever="model-value"]')!.textContent!;
  expect(model).not.toMatch(/415|400/);
  expect(model).not.toMatch(/hundred/i);
  const demand = JSON.stringify(h.state().task!.demand);
  expect(demand).not.toMatch(/four hundred|\b400\b/);
  h.say('four hundred'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['block_picture', 'model_value'] });
  h.close();
});
