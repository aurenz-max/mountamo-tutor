// @vitest-environment jsdom
/**
 * measure-lab levers, mounted the way a lesson mounts them. A pull changes the screen and the scene fact in one
 * commit and draws no answer; the next attempt records the lever; a refused pull changes nothing; an easier item is
 * ungraded practice of the same mode, and the full item comes back blank and is credited after it.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { MeasureLabChallenge } from './MeasureLab';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const jar = (id: string, name: string, filled: number) => ({ id, name, shape: 'round' as const, capacity: 8, filled });
const C: Record<string, MeasureLabChallenge> = {
  balance_predict: { id: 'b', type: 'balance_predict', prompt: 'Which is heavier — the book or the sock?',
    left: { id: 'l', name: 'book', emoji: '📖', weight: 8 }, right: { id: 'r', name: 'sock', emoji: '🧦', weight: 2 }, expectedChoice: 'l' },
  capacity_predict: { id: 'c', type: 'capacity_predict', prompt: 'Which holds more — the mug or the bowl?', unitName: 'cups',
    containerA: { id: 'a', name: 'mug', shape: 'tall', capacity: 3 }, containerB: { id: 'w', name: 'bowl', shape: 'wide', capacity: 7 }, expectedChoice: 'w' },
  pour_count: { id: 'p', type: 'pour_count', prompt: 'Fill the pot with cups. How many does it take?', unitName: 'cups',
    container: { id: 'pot', name: 'pot', shape: 'round', capacity: 6 }, expectedCount: 6, options: [5, 6, 7, 8] },
  order_capacity: { id: 'o', type: 'order_capacity', prompt: 'Put the pots in order. Start with the one that has the least.',
    containers: [jar('j1', 'pot 1', 7), jar('j2', 'pot 2', 2), jar('j3', 'pot 3', 4)], expectedOrder: ['j2', 'j3', 'j1'] },
};
const mount = (mode: string, challenges: MeasureLabChallenge[]) => {
  const h = mountWorkspace({ primitiveId: 'measure-lab', evalMode: mode, instanceId: 'measure',
    data: { title: 'Measuring', description: 'Test it', challengeType: mode, challenges } });
  h.settle(2000);
  return h;
};
const tap = (h: WorkspaceHarness, labels: string[]) => { for (const label of labels) h.press(label); h.settle(1000); };
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;

it('balance: the model balance shows in the same commit, names no object; a repeat pull changes nothing; the next attempt records it', () => {
  const h = mount('balance_predict', [C.balance_predict]);
  expect(levers(h)).toEqual([['down_model', false], ['far_pair', false]]);
  tap(h, ['sock', 'Put book on', 'Put sock on']);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'picked_lighter' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'picked_lighter')).toBe('down_model');
  expect(q(h, '[data-lever="down-model"]')).toHaveLength(0);
  const receipt = h.dispatch('pull_lever', { lever: 'down_model' });
  expect(receipt.status).toBe('committed');
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/model balance/);
  expect(String(receipt.state.task!.demand.onScreen)).not.toMatch(/book|sock|\d/);
  expect(q(h, '[data-lever="down-model"]')).toHaveLength(1);
  const before = { demand: JSON.stringify(h.state().task!.demand), levers: levers(h), attempts: attempts(h).length, html: h.view.container.innerHTML };
  expect(h.dispatch('pull_lever', { lever: 'down_model' }).status).toBe('blocked');
  expect({ demand: JSON.stringify(h.state().task!.demand), levers: levers(h), attempts: attempts(h).length, html: h.view.container.innerHTML }).toEqual(before);
  h.dispatch('retry');
  expect(q(h, '[data-lever="down-model"]')).toHaveLength(1);
  tap(h, ['book', 'Put book on', 'Put sock on']);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'b', correct: true, levers: ['down_model'] });
  h.close();
});

it('balance: the easier pair is ungraded practice; the full item comes back blank and is credited after it', () => {
  const h = mount('balance_predict', [C.balance_predict]);
  tap(h, ['sock', 'Put book on', 'Put sock on']);
  const receipt = h.dispatch('pull_lever', { lever: 'far_pair' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('b~smaller');
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 'b' });
  expect(h.view.container.textContent).toMatch(/Practice/);
  expect(h.view.container.textContent).not.toMatch(/book|sock/);
  tap(h, ['brick', 'Put feather on', 'Put brick on']);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('b');
  expect(demand(h)).toMatchObject({ learnerWork: 'No guess yet', scale: 'empty and level' });
  expect(h.view.container.textContent).not.toMatch(/Practice/);
  tap(h, ['book', 'Put book on', 'Put sock on']);
  expect(attempts(h).map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['b', false, false], ['b~smaller', true, true], ['b', true, false]]);
  expect(attempts(h).at(-1)).toMatchObject({ levers: ['far_pair'] });
  h.close();
});

it('capacity: the shelves appear empty, and hold one cup per cup only once the test has filled both', () => {
  const h = mount('capacity_predict', [C.capacity_predict]);
  expect(levers(h)).toEqual([['cup_lines', false], ['easy_pair', false]]);
  // Help before any attempt (I'm stuck): the shelves show, with no cup on them.
  expect(h.dispatch('pull_lever', { lever: 'cup_lines' }).status).toBe('committed');
  expect(q(h, '[data-lever="cup-shelf"]')).toHaveLength(2);
  expect(q(h, '[data-lever="shelf-cup"]')).toHaveLength(0);
  h.press('mug');
  expect(q(h, '[data-lever="shelf-cup"]')).toHaveLength(0);
  h.press('Pour cups into both'); h.settle(1000);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'tall_means_more', levers: ['cup_lines'] });
  expect(q(h, '[data-container="a"] [data-lever="shelf-cup"]')).toHaveLength(3);
  expect(q(h, '[data-container="w"] [data-lever="shelf-cup"]')).toHaveLength(7);
  h.dispatch('retry');
  expect(q(h, '[data-lever="shelf-cup"]')).toHaveLength(0);
  h.close();
});

it('capacity: the easier pair draws one container much larger and is practice of the same mode', () => {
  const h = mount('capacity_predict', [C.capacity_predict]);
  tap(h, ['mug', 'Pour cups into both']);
  const receipt = h.dispatch('pull_lever', { lever: 'easy_pair' });
  expect(receipt.state.task!.itemId).toBe('c~smaller');
  expect(String(receipt.state.task!.demand.containers)).toMatch(/drawn small.*drawn large/);
  expect(receipt.state.task!.demand.kind).toBe('capacity_predict');
  tap(h, ['tub', 'Pour cups into both']);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('c');
  h.close();
});

it('pour_count: the shelf shows each poured cup, never a number; the smaller container takes three', () => {
  const h = mount('pour_count', [C.pour_count]);
  expect(levers(h)).toEqual([['poured_shelf', false], ['smaller_pour', false]]);
  expect(h.dispatch('pull_lever', { lever: 'poured_shelf' }).status).toBe('committed');
  expect(q(h, '[data-lever="cup-shelf"]')).toHaveLength(1);
  expect(String(demand(h).onScreen)).not.toMatch(/\d/);
  for (let i = 0; i < 4; i++) h.press('Pour one in');
  expect(q(h, '[data-lever="shelf-cup"]')).toHaveLength(4);
  expect(q(h, '[data-lever="cup-shelf"]')[0].textContent).not.toMatch(/\d/);
  for (let i = 0; i < 2; i++) h.press('Pour one in');
  h.press('5');
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'one_short', levers: ['poured_shelf'] });
  expect(nextLever(h.state().task!.workspace!.levers!, 'one_short')).toBe('smaller_pour');
  const receipt = h.dispatch('pull_lever', { lever: 'smaller_pour' });
  expect(receipt.state.task!.itemId).toBe('p~smaller');
  expect(q(h, '[data-lever="cup-shelf"]')).toHaveLength(0);
  for (let i = 0; i < 3; i++) h.press('Pour one in');
  h.press('3');
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('p');
  expect(demand(h)).toMatchObject({ level: 'empty' });
  expect(q(h, '[data-lever="cup-shelf"]')).toHaveLength(1);
  h.close();
});

it('order: bars and level lines draw the same on every jar; the far set is offered only when two levels are close', () => {
  const h = mount('order_capacity', [C.order_capacity]);
  expect(levers(h)).toEqual([['order_steps', false], ['level_lines', false], ['far_levels', false]]);
  tap(h, ['pot 1', 'pot 3', 'pot 2']);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'most_to_least' });
  expect(h.dispatch('pull_lever', { lever: 'order_steps' }).status).toBe('committed');
  expect(q(h, '[data-lever="order-steps"] > div')).toHaveLength(3);
  expect(h.dispatch('pull_lever', { lever: 'level_lines' }).status).toBe('committed');
  expect(q(h, '[data-lever="level-line"]')).toHaveLength(21);
  expect(String(demand(h).onScreen)).not.toMatch(/pot|\d/);
  cleanup();
  const far = mount('order_capacity', [{ ...C.order_capacity, containers: [jar('j1', 'pot 1', 7), jar('j2', 'pot 2', 1), jar('j3', 'pot 3', 4)] }]);
  expect(levers(far)).toEqual([['order_steps', false], ['level_lines', false]]);
  far.close();
});
