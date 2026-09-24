// @vitest-environment jsdom
/**
 * Word sorter on the teaching workspace: what is its own. The generic W1 contract
 * (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const SORT = { id: 'ch1', type: 'binary_sort', instruction: '', bucketLabels: ['Animals', 'Food'], bucketEmojis: ['🐾', '🍎'],
  words: [{ id: 'w0', word: 'dog', emoji: '🐕', correctBucket: 'Animals' }, { id: 'w1', word: 'bread', emoji: '🍞', correctBucket: 'Food' }] };
const THREE = { id: 'ch3', type: 'ternary_sort', instruction: '', bucketLabels: ['Animals', 'Food', 'Toys'],
  words: [{ id: 't0', word: 'ball', correctBucket: 'Toys' }, { id: 't1', word: 'cow', correctBucket: 'Animals' },
    { id: 't2', word: 'apple', correctBucket: 'Food' }] };
const MATCH = { id: 'ch2', type: 'match_pairs', instruction: '', relationLabel: 'opposite',
  pairs: [{ id: 'p0', term: 'big', match: 'small' }, { id: 'p1', term: 'hot', match: 'cold' }] };
const data = (gradeLevel: string, ...challenges: unknown[]) =>
  ({ title: 'Sorting', gradeLevel, sortingTopic: 'Things', challenges }) as unknown as Record<string, unknown>;
const BY_MODE: Record<string, { challenge: unknown; key: RegExp }> = {
  binary_sort: { challenge: SORT, key: /^Animals, the group dog belongs with/ },
  ternary_sort: { challenge: THREE, key: /^Toys, the group ball belongs with/ },
  match_pairs: { challenge: MATCH, key: /^small, the opposite of big/ },
};

it.each(Object.keys(BY_MODE))('%s binds: one spoken answer judged against the key, nothing marked before credit', mode => {
  const d = data('1', BY_MODE[mode].challenge);
  expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'word-sorter', pin: mode, objectiveIds: ['o'], data: d })).not.toBeNull();
  const h = mountWorkspace({ primitiveId: 'word-sorter', evalMode: mode, data: d });
  expect(h.state().task!.workspace!.expectedAnswer).toMatch(BY_MODE[mode].key);
  expect(h.view.container.querySelectorAll('.border-emerald-400\\/40')).toHaveLength(0);
});

it('the tier lever decides whether the tutor may name the groups; K always may', () => {
  const hard = { ...SORT, namesSortCriterion: false };
  const reader = mountWorkspace({ primitiveId: 'word-sorter', evalMode: 'binary_sort', data: data('1', hard) });
  expect(String(reader.state().task!.demand?.namingChoices)).toMatch(/do not name them/);
  expect(reader.state().task!.task).not.toMatch(/Animals/);
  cleanup();
  const k = mountWorkspace({ primitiveId: 'word-sorter', evalMode: 'binary_sort', data: data('K', hard) });
  expect(String(k.state().task!.demand?.namingChoices)).toMatch(/may name/);
});

it('a wrong group reopens with nothing placed; a credit files the word on its mat; the lesson completes once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mountWorkspace({ primitiveId: 'word-sorter', evalMode: 'binary_sort', data: data('1', SORT) });
  h.say('Food'); h.feedback('incorrect', 'retry');
  // Only the word card says dog: nothing is filed on a mat after a miss.
  expect(screen.getAllByText('dog')).toHaveLength(1);
  h.say('Animals'); h.feedback('correct', 'advance'); h.confirmVisible();
  // The card now shows bread, and dog is filed as a badge on its mat.
  expect(screen.getAllByText('bread')).toHaveLength(1);
  expect(screen.getAllByText('dog')).toHaveLength(1);
  h.say('Food'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ wordsProcessed: 2 });
});

it('hear-again asks for the question silently, as the host, never the answer', () => {
  mountWorkspace({ primitiveId: 'word-sorter', evalMode: 'match_pairs', data: data('1', MATCH) });
  fireEvent.click(screen.getByLabelText('Hear the question again'));
  const [text, options] = seam.send.mock.calls.at(-1)!;
  expect(text).toContain('big');
  expect(text).not.toMatch(/\bsmall\b/);
  expect(options).toMatchObject({ silent: true, author: 'host' });
});
