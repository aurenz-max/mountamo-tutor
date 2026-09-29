// @vitest-environment jsdom
/**
 * word-sorter's levers on the shared teaching workspace (handoff 22 L4). A pull changes the mats in the same commit,
 * marks no group as right, shows only the learner's own credited words, and the next attempt carries it.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const HARD = { showBucketEmojis: false, showFiledWords: false };
const SORT = { id: 'ch1', type: 'binary_sort', instruction: '', bucketLabels: ['Animals', 'Food'], bucketEmojis: ['🐾', '🍎'], ...HARD,
  words: [{ id: 'w0', word: 'dog', emoji: '🐕', correctBucket: 'Animals' }, { id: 'w1', word: 'bread', emoji: '🍞', correctBucket: 'Food' },
    { id: 'w2', word: 'cat', emoji: '🐈', correctBucket: 'Animals' }] };
const MATCH = { id: 'ch2', type: 'match_pairs', instruction: '', relationLabel: 'opposite', ...HARD,
  pairs: [{ id: 'p0', term: 'big', match: 'small' }, { id: 'p1', term: 'hot', match: 'cold' }] };
const data = (...challenges: unknown[]) =>
  ({ title: 'Sorting', gradeLevel: '1', sortingTopic: 'Things', challenges }) as unknown as Record<string, unknown>;
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers?.map(l => l.id) ?? [];

it('group_pictures: a picture on every mat in the commit, none marked; the credit is assisted', () => {
  const h = mountWorkspace({ primitiveId: 'word-sorter', evalMode: 'binary_sort', data: data(SORT) });
  expect(levers(h)).toEqual(['group_pictures']);
  expect(q(h, '[data-lever="group-picture"]')).toHaveLength(0);
  h.say('dog'); h.feedback('incorrect', 'retry');
  const receipt = h.dispatch('pull_lever', { lever: 'group_pictures' });
  expect(q(h, '[data-lever="group-picture"]').map(e => e.textContent)).toEqual(['🐾', '🍎']);
  expect(String(receipt.state.task!.demand.levers_on_screen)).toMatch(/every group mat/);
  expect(q(h, '.border-emerald-400\\/40')).toHaveLength(0);
  h.say('Animals'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['group_pictures'] });
  h.close();
});

it('filed_examples: offered once a word is credited; shows only credited words, never the current one', () => {
  const h = mountWorkspace({ primitiveId: 'word-sorter', evalMode: 'binary_sort', data: data(SORT) });
  h.say('Animals'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task).toMatchObject({ itemId: 'ch1::w1' });
  expect(levers(h)).toEqual(['group_pictures', 'filed_examples']);
  expect(q(h, '[data-lever="filed-word"]')).toHaveLength(0);
  h.dispatch('pull_lever', { lever: 'filed_examples' });
  expect(q(h, '[data-lever="filed-word"]').map(e => e.textContent)).toEqual(['🐕dog']);
  expect(h.dispatch('pull_lever', { lever: 'filed_examples' }).status).not.toBe('ok');
  h.say('Food'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(q(h, '[data-lever="filed-word"]')).toHaveLength(0);
  h.close();
});

it('match_pairs: no pictures lever; filed pairs come after the first credit', () => {
  const h = mountWorkspace({ primitiveId: 'word-sorter', evalMode: 'match_pairs', data: data(MATCH) });
  expect(levers(h)).toEqual([]);
  expect(h.offer('pull_lever')).toBeFalsy();
  h.say('small'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(levers(h)).toEqual(['filed_examples']);
  h.dispatch('pull_lever', { lever: 'filed_examples' });
  expect(q(h, '[data-lever="filed-pairs"]')[0].textContent).toBe('big → small');
  h.close();
});
