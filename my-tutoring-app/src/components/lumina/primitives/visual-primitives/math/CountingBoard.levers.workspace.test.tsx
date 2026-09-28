// @vitest-environment jsdom
/**
 * The counting-board levers on the shared teaching workspace (handoff 21 M1), mounted the way a lesson mounts
 * it. A pull changes the board in the same commit and states no number; the easier ask is ungraded practice
 * that returns to the full item; a removed hand is assisted work on the same item.
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

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const giveData = (aids: boolean) => ({ title: 'Give me', gradeBand: 'K', objects: { type: 'bears', count: 8, arrangement: 'scattered' },
  showOptions: { showRunningCount: aids, showLastNumber: aids, showGroupCircles: false, highlightOnTap: true },
  challenges: [{ id: 'c1', type: 'give_me_n', instruction: 'Give me four bears.', count: 8, targetAnswer: 4, arrangement: 'scattered' },
    { id: 'c2', type: 'give_me_n', instruction: 'Give me three bears.', count: 7, targetAnswer: 3, arrangement: 'scattered' }] });
const handData = { title: 'Match', gradeBand: 'K', objects: { type: 'bears', count: 1, arrangement: 'scattered' },
  showOptions: { showRunningCount: false, showLastNumber: true, showGroupCircles: false, highlightOnTap: true },
  challenges: [{ id: 'h1', type: 'subitize_perceptual', instruction: 'Tap the hand that matches.', count: 1, targetAnswer: 1, arrangement: 'scattered' }] };

const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers ?? [];
const give = (h: WorkspaceHarness, n: number) => { for (let i = 0; i < n; i++) h.touch(`object-${i}`); h.press('Give them to me'); };
const objectRows = (h: WorkspaceHarness) => new Set(Array.from(h.view.container.querySelectorAll('[data-pip-object^="object-"] > circle:last-of-type'))
  .map(c => c.getAttribute('cy')));

it('with the counting aids off, a pull of running_count shows the count taken, in the same commit, and states no ask', () => {
  const h = mountWorkspace({ primitiveId: 'counting-board', evalMode: 'give_me_n', data: giveData(false), instanceId: 'board' });
  expect(levers(h).map(l => [l.id, l.kind, l.pulled])).toEqual([['running_count', 'help', false], ['count_tags', 'help', false],
    ['line_up', 'help', false], ['smaller_give', 'simplify', false]]);
  give(h, 2);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'short_by_more' });
  expect(h.view.container.querySelector('[data-lever="running-count"]')).toBeNull();
  h.dispatch('pull_lever', { lever: 'running_count' });
  // The board was cleared by nothing: the learner's two are still taken, and the count says so.
  expect(h.view.container.querySelector('[data-lever="running-count"]')?.textContent).toMatch(/Counted:\s*2/);
  expect(h.state().task!.demand.onScreen).toMatch(/count of the objects taken/);
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/\b4\b|four/);
  h.dispatch('retry');
  give(h, 4);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['running_count'] });
  h.close();
});

it('count_tags numbers only the objects taken, and line_up lays the same pile out in a single row', () => {
  const h = mountWorkspace({ primitiveId: 'counting-board', evalMode: 'give_me_n', data: giveData(false), instanceId: 'board' });
  h.touch('object-0'); h.touch('object-1');
  expect(h.view.container.querySelectorAll('[data-lever="count-tag"]')).toHaveLength(0);
  h.dispatch('pull_lever', { lever: 'count_tags' });
  expect(Array.from(h.view.container.querySelectorAll('[data-lever="count-tag"]')).map(t => t.textContent)).toEqual(['1', '2']);
  const objects = h.view.container.querySelectorAll('[data-pip-object^="object-"]').length;
  expect(objectRows(h).size).toBeGreaterThan(1);
  h.dispatch('pull_lever', { lever: 'line_up' });
  expect(h.view.container.querySelectorAll('[data-pip-object^="object-"]')).toHaveLength(objects);
  expect(objectRows(h).size).toBe(1);
  expect(h.state().task!.demand.onScreen).toMatch(/single row/);
  h.close();
});

it('the easier ask is ungraded practice from the same pile, then the full ask is credited with its lever', () => {
  const h = mountWorkspace({ primitiveId: 'counting-board', evalMode: 'give_me_n', data: giveData(true), instanceId: 'board' });
  // The tier's counting aids start pulled; that is not a pull.
  expect(levers(h).filter(l => l.pulled).map(l => l.id)).toEqual(['running_count', 'count_tags']);
  give(h, 8);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'gave_all', assisted: false });
  h.dispatch('pull_lever', { lever: 'smaller_give' });
  expect(h.state().task).toMatchObject({ itemId: 'c1~smaller' });
  expect(h.state().task!.task).toMatch(/Give me two bears/);
  expect(h.state().task!.workspace!.practice).toEqual({ returnsTo: 'c1' });
  give(h, 2);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'c1' });
  give(h, 4);
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['c1', false, false], ['c1~smaller', true, true], ['c1', true, false]]);
  expect(attempts.at(-1)).toMatchObject({ levers: ['smaller_give'], assisted: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'c2' });
  expect(levers(h).filter(l => l.pulled).map(l => l.id)).toEqual(['running_count', 'count_tags']);
  h.close();
});

it('two_hands takes away the far hand, keeps the matching one, and the pick after it is assisted', () => {
  const h = mountWorkspace({ primitiveId: 'counting-board', evalMode: 'subitize_perceptual', data: handData, instanceId: 'board' });
  expect(levers(h).map(l => l.id)).toEqual(['two_hands']);
  h.touch('hand-3');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'over_by_more' });
  h.dispatch('pull_lever', { lever: 'two_hands' });
  const hands = Array.from(h.view.container.querySelectorAll('[data-pip-object^="hand-"]')).map(b => b.getAttribute('data-pip-object'));
  expect(hands.sort()).toEqual(['hand-1', 'hand-2']);
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/hand-1|\bone\b|\b1\b/);
  h.dispatch('retry');
  h.touch('hand-1');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['two_hands'] });
  h.close();
});
