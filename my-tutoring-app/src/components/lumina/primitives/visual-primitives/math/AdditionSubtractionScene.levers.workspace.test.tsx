// @vitest-environment jsdom
/**
 * The addition-subtraction-scene levers on the shared teaching workspace, mounted the way a lesson mounts it
 * (`additionSubtractionSceneLevers.ts`). A pull changes the picture and the scene fact in one commit and states no
 * answer; a refused pull changes nothing; the smaller story is ungraded practice and the full story comes back blank.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import type { AddSubChallenge } from './AdditionSubtractionScene';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const ch = (over: Partial<AddSubChallenge>): AddSubChallenge => ({
  id: 'c1', type: 'act-out', instruction: '', storyText: 'Two ducks swim in the pond. Three more ducks come.',
  scene: 'pond', objectType: 'ducks', operation: 'addition', storyType: 'join',
  startCount: 2, changeCount: 3, resultCount: 5, equation: '2 + 3 = 5', ...over,
});
const second = ch({ id: 'c2', startCount: 1, changeCount: 1, resultCount: 2, equation: '1 + 1 = 2',
  storyText: 'One duck swims in the pond. One more duck comes.' });
const data = (gradeBand: 'K' | '1', challenges: AddSubChallenge[]) => ({
  title: 'Story', gradeBand, maxNumber: gradeBand === 'K' ? 5 : 10, showTenFrame: false, showEquationBar: true, challenges,
});
const mount = (d: object, evalMode: string) =>
  mountWorkspace({ primitiveId: 'addition-subtraction-scene', evalMode, data: d as Record<string, unknown>, instanceId: 'story' });

const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers ?? [];
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const objects = (h: WorkspaceHarness) => Array.from(h.view.container.querySelectorAll('[data-pip-object^="object-"] > circle:first-of-type'));
const add = (h: WorkspaceHarness, n: number) => { for (let i = 0; i < n; i++) h.press('Add one ducks'); };
const pen = (h: WorkspaceHarness) => h.view.container.querySelector('[data-lever="story-groups"] rect');

it('story_groups: one commit moves the start group into a pen and says so; the next try records it; a refused pull changes nothing', () => {
  const h = mount(data('K', [ch({}), second]), 'act_out');
  expect(levers(h).map(l => [l.id, l.kind, l.pulled])).toEqual([['story_groups', 'help', false], ['smaller_story', 'simplify', false]]);
  add(h, 1); h.settle(3000);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'short_by_more' });
  expect(pen(h)).toBeNull();
  h.dispatch('pull_lever', { lever: 'story_groups' });
  // Same commit: the pen is drawn, the two there at the start are inside it, the one brought in is outside.
  const box = pen(h)!;
  const [x, w] = [Number(box.getAttribute('x')), Number(box.getAttribute('width'))];
  expect(objects(h).map(c => Number(c.getAttribute('cx')) < x + w)).toEqual([true, true, false]);
  expect(h.state().task!.demand.onScreen).toMatch(/two ducks there at the start .* pen/);
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/\bfive\b|\b5\b/);
  expect(levers(h).find(l => l.id === 'story_groups')!.pulled).toBe(true);

  // A refused pull (already pulled): the picture, the levers and the attempts are unchanged.
  const before = { html: h.view.container.innerHTML, levers: JSON.stringify(levers(h)), attempts: JSON.stringify(attempts(h)) };
  const receipt = h.dispatch('pull_lever', { lever: 'story_groups' });
  expect(receipt.status).not.toBe('committed');
  expect({ html: h.view.container.innerHTML, levers: JSON.stringify(levers(h)), attempts: JSON.stringify(attempts(h)) }).toEqual(before);

  h.dispatch('retry'); h.confirmVisible();
  expect(objects(h)).toHaveLength(2);
  add(h, 3); h.settle(3000);
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['story_groups'] });
  h.close();
});

it('subtraction: a sent-away duck stays as a faded outline inside the pen, never as an object', () => {
  const h = mount(data('K', [ch({ operation: 'subtraction', storyType: 'separate', startCount: 4, changeCount: 2, resultCount: 2,
    equation: '4 - 2 = 2', storyText: 'Four ducks swim in the pond. Two ducks swim away.' }), second]), 'act_out');
  h.dispatch('pull_lever', { lever: 'story_groups' });
  h.touch('object-1');
  expect(objects(h)).toHaveLength(3);
  expect(h.view.container.querySelectorAll('[data-lever="departed"]')).toHaveLength(1);
  expect(h.state().task!.demand.onScreen).toMatch(/faded outlines/);
  h.close();
});

it('smaller_story: an ungraded practice story, then the full story back blank and credited with the lever', () => {
  const h = mount(data('K', [ch({}), second]), 'act_out');
  add(h, 1); h.settle(3000);
  h.dispatch('pull_lever', { lever: 'smaller_story' });
  expect(h.state().task).toMatchObject({ itemId: 'c1~simpler' });
  expect(h.state().task!.task).toMatch(/There are two ducks in the pond\. One more joins them\./);
  expect(h.state().task!.workspace!.practice).toEqual({ returnsTo: 'c1' });
  expect(h.state().task!.demand.practice).toMatch(/practice story/);
  expect(levers(h)).toEqual([]);
  expect(objects(h)).toHaveLength(2);
  add(h, 1); h.settle(3000);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task).toMatchObject({ itemId: 'c1' });
  // Blank: the seeded start group only, and the practice's work is gone.
  expect(objects(h)).toHaveLength(2);
  add(h, 3); h.settle(3000);
  expect(attempts(h).map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['c1', false, false], ['c1~simpler', true, true], ['c1', true, false]]);
  expect(attempts(h).at(-1)).toMatchObject({ assisted: true, levers: ['smaller_story'] });
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task).toMatchObject({ itemId: 'c2' });
  expect(levers(h).map(l => l.pulled)).toEqual([false]);
  h.close();
});

it('sentence_frame: the tray becomes five empty boxes the learner\'s tiles fill in order', () => {
  const h = mount(data('1', [ch({ type: 'build-equation' }), { ...second, type: 'build-equation' }]), 'build_equation');
  expect(levers(h).map(l => l.id)).toEqual(['story_groups', 'sentence_frame', 'smaller_story']);
  h.press('Add tile 2'); h.press('Add tile +'); h.settle(4500);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'unfinished_equation' });
  h.dispatch('pull_lever', { lever: 'sentence_frame' });
  const boxes = () => Array.from(h.view.container.querySelectorAll('[data-frame-box]'));
  expect(boxes().map(b => [b.getAttribute('data-frame-box'), b.textContent])).toEqual([
    ['number', '2'], ['sign', '+'], ['number', ''], ['sign', ''], ['number', '']]);
  expect(h.state().task!.demand.onScreen).toMatch(/five boxes/);
  h.dispatch('retry'); h.confirmVisible();
  expect(boxes().map(b => b.textContent)).toEqual(['', '', '', '', '']);
  for (const t of ['2', '+', '3', '=', '5']) h.press(`Add tile ${t}`);
  expect(boxes().map(b => b.textContent)).toEqual(['2', '+', '3', '=', '5']);
  h.settle(1200);
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['sentence_frame'] });
  h.close();
});

it('solve-story asking for the change: no pen (it would set the answer apart); the smaller story asks for the end', () => {
  const h = mount(data('1', [ch({ type: 'solve-story', unknownPosition: 'change', startCount: 4, changeCount: 3, resultCount: 7,
    equation: '4 + 3 = 7', storyText: 'Four ducks swim in the pond. Some more ducks come. Now there are seven ducks.' }),
  { ...second, type: 'solve-story', unknownPosition: 'result' }]), 'solve_story');
  expect(levers(h).map(l => l.id)).toEqual(['smaller_story']);
  h.say('seven'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'smaller_story' });
  expect(h.state().task).toMatchObject({ itemId: 'c1~simpler' });
  expect(h.state().task!.workspace!.expectedAnswer).toMatch(/^five \(5\)/);
  h.say('five'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('c1');
  h.say('three'); h.feedback('correct');
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'c1', correct: true, assisted: true, levers: ['smaller_story'] });
  h.close();
});

it('a picture built past the story shows every object brought in (the over-built picture is what one_over names)', () => {
  const h = mount(data('K', [ch({ startCount: 2, changeCount: 1, resultCount: 3, equation: '2 + 1 = 3',
    storyText: 'Two ducks swim in the pond. One more duck comes.' }), second]), 'act_out');
  expect(h.state().task!.itemId).toBe('c1');
  add(h, 2);
  expect(objects(h)).toHaveLength(4);
  h.settle(3000);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'one_over' });
  h.close();
});
