// @vitest-environment jsdom
/**
 * build_two_ways, base-ten-blocks' open build, on the shared teaching workspace, mounted the way a lesson mounts it.
 * The learner builds the number on an empty mat with any blocks, presses I'm done, then changes the blocks to show it
 * a different way. The mat judges the value and different-from-first in code, prints no total, publishes the made value
 * and the blocks per place as numbers, keeps the build on Try again, and starts with no lever pulled.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('@/components/lumina/components/JudgedMicPanel', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).micPanelSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { twoWaysInstruction } from './baseTenWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const data = (targets = [34, 52]) => ({ title: 'Two ways', description: 'Show a number two ways.', numberValue: targets[0],
  interactionMode: 'build', maxPlace: 'hundreds', gradeBand: '2-3',
  challenges: targets.map(n => ({ type: 'build_two_ways', instruction: twoWaysInstruction(n), targetNumber: n,
    hint: 'A big block can be swapped for the smaller blocks it is worth.' })) });
const mount = (targets?: number[]) =>
  mountWorkspace({ primitiveId: 'base-ten-blocks', evalMode: 'build_two_ways', data: data(targets), instanceId: 'blocks' });
const put = (h: WorkspaceHarness, tens: number, ones: number) => {
  for (let i = 0; i < tens; i++) h.press('Add one to Tens');
  for (let i = 0; i < ones; i++) h.press('Add one to Ones');
};
const done = (h: WorkspaceHarness) => h.press("I'm done!");
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const facts = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const mat = (h: WorkspaceHarness) => h.view.container.querySelector('[data-base-ten-mat="click"]')!;
const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers ?? [];

it('the item is a gesture build on an empty mat: no keypad, no Check button, no total, no key published', () => {
  const h = mount();
  expect(facts(h).response).toBe('gesture');
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  expect(h.state().task!.task).toBe('Show 34 with blocks. Then show 34 a different way.');
  expect(mat(h).querySelectorAll('[data-block]')).toHaveLength(0);
  expect(h.view.container.textContent).not.toMatch(/Check My Blocks|Blocks Total|Your Answer/);
  expect(h.view.container.querySelector('[data-build-scene="base-ten"]')).not.toBeNull();
  expect(facts(h)).toMatchObject({ kind: 'build_two_ways', way: 'first', valueMade: 0, hundredsOnMat: 0, tensOnMat: 0, onesOnMat: 0 });
  h.close();
});

it('any blocks with the value pass the first way; the same blocks again is same_as_first; a different way completes', () => {
  const h = mount();
  // The first way in non-standard form: thirty-four can be 2 tens and 14 ones.
  put(h, 2, 14);
  expect(mat(h).querySelectorAll('[data-block="tens"]')).toHaveLength(2);
  expect(mat(h).querySelectorAll('[data-block="ones"]')).toHaveLength(14);
  expect(facts(h)).toMatchObject({ valueMade: 34, tensOnMat: 2, onesOnMat: 14 });
  // The mat never prints the value, and no count shows before a lever.
  expect(mat(h).textContent).not.toMatch(/34|14/);
  done(h);
  // A right first way is not a commit: it is kept above the mat and the second way starts from it.
  expect(h.state().task!.workspace!.attempts).toHaveLength(0);
  expect(h.view.container.querySelector('[data-first-way]')).not.toBeNull();
  expect(facts(h)).toMatchObject({ way: 'second', firstWay: '2 tens and 14 ones', tensOnMat: 2, onesOnMat: 14 });
  done(h);
  expect(last(h)).toMatchObject({ correct: false, miss: 'same_as_first' });
  expect(h.view.container.textContent).toMatch(/same way as your first/);
  h.dispatch('retry');
  // Try again keeps the build and the first way.
  expect(facts(h)).toMatchObject({ way: 'second', tensOnMat: 2, onesOnMat: 14 });
  expect(h.view.container.querySelector('[data-first-way]')).not.toBeNull();
  for (let i = 0; i < 10; i++) h.press('Take one from Ones');
  h.press('Add one to Tens');
  done(h);
  expect(last(h)).toMatchObject({ correct: true });
  expect(h.state().task!.task).toBe('Show 34 with blocks. Then show 34 a different way.');
  // The tutor hears the learner's two ways in words, never a total.
  const heard = JSON.stringify(h.sent);
  expect(heard).toMatch(/Second way: 3 tens and 4 ones \(first way: 2 tens and 14 ones\)/);
  h.close();
});

it('a ten off and one off are named misses; Try again keeps the build; the feedback never states the learner\'s total', () => {
  const h = mount();
  put(h, 2, 4);
  done(h);
  expect(last(h)).toMatchObject({ correct: false, miss: 'one_ten_off' });
  expect(h.view.container.textContent).not.toMatch(/\b24\b/);
  h.dispatch('retry');
  expect(facts(h)).toMatchObject({ way: 'first', valueMade: 24, tensOnMat: 2, onesOnMat: 4 });
  h.settle(2000);
  h.press('Add one to Tens');
  h.press('Add one to Ones');
  done(h);
  expect(last(h)).toMatchObject({ correct: false, miss: 'one_over' });
  h.dispatch('retry');
  // The learner's own change, after the host's retry has settled (a change inside 1.5 s of it is the host's).
  h.settle(2000);
  h.press('Take one from Ones');
  done(h);
  expect(h.state().task!.workspace!.attempts).toHaveLength(2);
  expect(facts(h)).toMatchObject({ way: 'second', firstWay: '3 tens and 4 ones' });
  // The workspace's history names where the learner turned back.
  expect(String(h.state().task!.demand.workHistory ?? '')).toMatch(/onesOnMat 0 → 5 → 4/);
  h.close();
});

it('levers start bare; column_counts shows the learner\'s own counts as a building aid; ten_model draws the swap', () => {
  const h = mount();
  expect(levers(h).map(l => [l.id, l.kind, l.pulled])).toEqual([['column_counts', 'help', false], ['ten_model', 'help', false],
    ['smaller_number', 'simplify', false]]);
  expect(mat(h).querySelectorAll('[data-aid="count"]')).toHaveLength(0);
  put(h, 3, 3);
  done(h);
  expect(last(h)).toMatchObject({ miss: 'one_short' });
  h.dispatch('pull_lever', { lever: 'column_counts' });
  const counts = Array.from(mat(h).querySelectorAll('[data-aid="count"]')).map(e => e.textContent);
  expect(counts).toEqual(['0', '3', '3']);
  h.dispatch('pull_lever', { lever: 'ten_model' });
  expect(h.view.container.querySelector('[data-lever="ten-model"]')).not.toBeNull();
  expect(String(facts(h).onScreen)).toMatch(/how many of the learner's blocks.*smaller blocks it is worth/);
  expect(String(facts(h).onScreen)).not.toMatch(/\d/);
  h.close();
});

it('smaller_number opens ungraded practice on about half the number, then the full item on an empty mat', () => {
  const h = mount();
  const full = h.state().task!.itemId;
  put(h, 9, 0);
  done(h);
  expect(last(h)).toMatchObject({ miss: 'over_by_more' });
  h.dispatch('pull_lever', { lever: 'smaller_number' });
  expect(h.state().task).toMatchObject({ itemId: `${full}~smaller`, task: 'Show 17 with blocks. Then show 17 a different way.' });
  expect(facts(h)).toMatchObject({ way: 'first', valueMade: 0 });
  put(h, 1, 7); done(h);
  h.press('Take one from Tens');
  for (let i = 0; i < 10; i++) h.press('Add one to Ones');
  done(h);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: full });
  expect(facts(h)).toMatchObject({ way: 'first', valueMade: 0 });
  put(h, 3, 4); done(h);
  put(h, 0, 0); h.press('Take one from Tens'); for (let i = 0; i < 10; i++) h.press('Add one to Ones'); done(h);
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct])).toEqual([[full, false], [`${full}~smaller`, true], [full, true]]);
  expect(attempts.at(-1)).toMatchObject({ levers: ['smaller_number'], assisted: true });
  h.close();
});

it('tapping a column puts a block in and tapping a block takes it out', () => {
  const h = mount();
  const column = () => mat(h).querySelector('[data-column="tens"] rect')!;
  act(() => { fireEvent.click(column()); fireEvent.click(column()); });
  expect(facts(h)).toMatchObject({ tensOnMat: 2 });
  act(() => { fireEvent.click(mat(h).querySelector('[data-block="tens"]')!); });
  expect(facts(h)).toMatchObject({ tensOnMat: 1, valueMade: 10 });
  h.close();
});

it("nothing checks on stillness: the build waits for I'm done, and the tutor is told once the learner stops", () => {
  const h = mount();
  h.settle(2000);
  put(h, 2, 0);
  h.settle(6000);
  expect(h.state().task!.workspace!.attempts).toHaveLength(0);
  expect(h.state().task!.phase).toBe('working');
  const said = seam.send.mock.calls.map(c => String(c[0]));
  expect(said.filter(t => /changed their work and has stopped/.test(t))).toHaveLength(1);
  h.close();
});
