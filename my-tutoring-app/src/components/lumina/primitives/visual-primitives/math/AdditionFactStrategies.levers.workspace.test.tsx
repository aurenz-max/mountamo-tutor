// @vitest-environment jsdom
/**
 * The addition-fact-strategies levers on the shared teaching workspace, mounted the way a lesson mounts it.
 * A pull changes the screen and the scene in the same commit and never states the total; the next attempt carries
 * the lever; a simplify pull opens an ungraded smaller fact that returns to the full item, which alone is credited.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import type { AdditionFactChallenge, AdditionFactStrategiesData, AdditionFactStrategy } from './AdditionFactStrategies';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const fact = (id: string, a: number, b: number, turn = false): AdditionFactChallenge =>
  ({ id, type: turn ? 'turnaround' : 'facts_mixed', a, b, sum: a + b, ...(turn ? { knownFact: { a: b, b: a } } : {}) });
const session = (strategy: AdditionFactStrategy, challenges: AdditionFactChallenge[], extra: Partial<AdditionFactStrategiesData> = {}) =>
  ({ title: 'Facts', description: 'Practise', challengeType: 'recall' as const, strategy, objectEmoji: '🍎', challenges, ...extra });

const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers ?? [];
const drawn = (h: WorkspaceHarness, name: string) => h.view.container.querySelectorAll(`[data-lever="${name}"]`);
const tap = (h: WorkspaceHarness, n: number) => h.press(`Answer ${n}`);

it('plus_one: hop_strip draws blank hops from the bigger number in the same commit; the scene states no total; the next attempt carries it', () => {
  const c = fact('f1', 1, 7), next = fact('f2', 4, 1);
  const h = mountWorkspace({ primitiveId: 'addition-fact-strategies', evalMode: 'plus_one', data: session('plus_one', [c, next]) });
  expect(levers(h).map(l => [l.id, l.kind, l.pulled])).toEqual([['hop_strip', 'help', false], ['count_groups', 'help', false], ['smaller_fact', 'simplify', false]]);
  tap(h, 9);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'one_over' });
  expect(drawn(h, 'hop-strip')).toHaveLength(0);

  const receipt = h.dispatch('pull_lever', { lever: 'hop_strip' });
  expect(receipt.status).toBe('committed');
  const strip = drawn(h, 'hop-strip')[0];
  expect(strip.textContent).toContain('7');
  expect(strip.textContent).not.toContain('8');
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/Hops are drawn/);
  expect(String(receipt.state.task!.demand.onScreen)).not.toMatch(/\d/);
  expect(h.dispatch('pull_lever', { lever: 'hop_strip' }).status).toBe('blocked');

  // The learner's own hop shows its number; nothing is checked by tapping it.
  h.dispatch('retry');
  act(() => { fireEvent.click(h.view.container.querySelector('button[aria-label="Hop"]')!); });
  expect(drawn(h, 'hop-strip')[0].textContent).toContain('8');
  expect(h.state().task!.workspace!.attempts).toHaveLength(1);
  tap(h, 8);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ itemId: 'f1', correct: true, assisted: true, levers: ['hop_strip'] });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('f2');
  expect(levers(h).every(l => !l.pulled)).toBe(true);
  expect(drawn(h, 'hop-strip')).toHaveLength(0);
  h.close();
});

it('big facts: near_double draws the double and the extra dot, captioned with the double and no total', () => {
  const c = fact('f1', 7, 8);
  const h = mountWorkspace({ primitiveId: 'addition-fact-strategies', evalMode: 'big_facts', data: session('facts_7_8', [c]) });
  h.dispatch('pull_lever', { lever: 'near_double' });
  const model = drawn(h, 'near-double')[0];
  expect(Array.from(model.querySelectorAll('[data-lever-dot]')).map(d => d.getAttribute('data-lever-dot')))
    .toEqual([...Array(14).fill('double'), 'extra']);
  expect(model.textContent).toBe('7 + 7 and one more');
  expect(String(h.state().task!.demand.onScreen)).not.toMatch(/14|15/);
  h.close();
});

it('turnaround: known_fact shows the flipped fact card only when pulled', () => {
  const c = fact('f1', 3, 8, true);
  const h = mountWorkspace({ primitiveId: 'addition-fact-strategies', evalMode: 'turnaround', data: session('turnaround', [c]) });
  expect(drawn(h, 'known-fact')).toHaveLength(0);
  h.dispatch('pull_lever', { lever: 'known_fact' });
  expect(drawn(h, 'known-fact')[0].textContent).toContain('8 + 3 = 11');
  expect(String(h.state().task!.demand.onScreen)).not.toMatch(/11/);
  h.close();
});

it('count_groups numbers only the objects the learner taps, and tapping checks nothing', () => {
  const c = fact('f1', 3, 4);
  const h = mountWorkspace({ primitiveId: 'addition-fact-strategies', evalMode: 'big_facts', data: session('facts_3_4', [c]) });
  h.dispatch('pull_lever', { lever: 'count_groups' });
  const objects = () => Array.from(drawn(h, 'count-groups')[0].querySelectorAll('button'));
  expect(objects()).toHaveLength(7);
  act(() => { fireEvent.click(objects()[4]); fireEvent.click(objects()[0]); });
  expect(objects().map(o => o.getAttribute('aria-label')).filter(l => l?.startsWith('Counted'))).toEqual(['Counted 2', 'Counted 1']);
  expect(h.state().task!.workspace!.attempts).toHaveLength(0);
  h.close();
});

it('easy starts with the objects on screen: a starting position, not a recorded pull', () => {
  const c = fact('f1', 6, 6);
  const h = mountWorkspace({ primitiveId: 'addition-fact-strategies', evalMode: 'doubles', data: session('doubles', [c], { supportTier: 'easy' }) });
  expect(levers(h).find(l => l.id === 'count_groups')!.pulled).toBe(true);
  expect(drawn(h, 'count-groups')).toHaveLength(1);
  tap(h, 12);
  expect(h.state().task!.workspace!.attempts.at(-1)!.levers).toBeUndefined();
  h.close();
});

it('a simplify pull opens an ungraded smaller fact, keeps it on Try again, then returns to the full item, which alone is credited', () => {
  const c = fact('f1', 7, 7), next = fact('f2', 6, 6);
  const h = mountWorkspace({ primitiveId: 'addition-fact-strategies', evalMode: 'doubles', data: session('doubles', [c, next]) });
  tap(h, 13);
  const receipt = h.dispatch('pull_lever', { lever: 'smaller_fact' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('f1~simpler');
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 'f1' });
  // 5 + 5: the largest double below 7 + 7 that the session does not ask (6 + 6 is the next fact).
  const shown = () => h.view.container.querySelector('[data-fact]')?.textContent;
  expect(shown()).toBe('5+5=?');
  tap(h, 9);
  h.dispatch('retry');
  expect(h.state().task!.itemId).toBe('f1~simpler');
  tap(h, 10);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ itemId: 'f1~simpler', correct: true, practice: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('f1');
  expect(shown()).toBe('7+7=?');
  tap(h, 14);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ itemId: 'f1', correct: true });
  h.close();
});
