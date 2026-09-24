// @vitest-environment jsdom
/**
 * Word flip on the teaching workspace: what is its own. The generic W1 contract
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
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const ITEMS: Record<string, Record<string, unknown>> = {
  plural_s: { type: 'plural_s', sourceWord: 'dog', answer: 'dogs', emoji: '🐕', count: 3 },
  plural_es: { type: 'plural_es', sourceWord: 'box', answer: 'boxes', emoji: '📦', count: 2 },
  plural_y: { type: 'plural_y', sourceWord: 'puppy', answer: 'puppies', emoji: '🐶', count: 4 },
  irregulars: { type: 'irregulars', sourceWord: 'sheep', answer: 'sheep', emoji: '🐑', count: 3 },
  past_ed: { type: 'past_ed', sourceWord: 'jump', answer: 'jumped', emoji: '🦘' },
  past_irregular: { type: 'past_irregular', sourceWord: 'run', answer: 'ran', emoji: '🏃' },
};
const flip = (mode: string, ids = ['a', 'b']) => ({ title: 'Flip', challengeType: mode, gradeLevel: 'K',
  challenges: ids.map((id, i) => ({ ...ITEMS[mode], id, ...(i ? { sourceWord: 'cat', answer: mode.startsWith('past') ? 'sat' : 'cats' } : {}) })) });

it.each(Object.keys(ITEMS))('%s binds: the new word is the spoken key, never in the task or on screen', mode => {
  const data = flip(mode);
  expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'word-flip', pin: mode, objectiveIds: ['o'], data })).not.toBeNull();
  const h = mountWorkspace({ primitiveId: 'word-flip', evalMode: mode, data });
  const answer = String(ITEMS[mode].answer);
  expect(h.state().task!.workspace!.expectedAnswer).toBe(answer);
  if (answer !== ITEMS[mode].sourceWord) {
    expect(h.state().task!.task).not.toContain(answer);
    expect(screen.queryByText(answer)).toBeNull();
  }
});

it('the source word said back reopens the item; the plural shows once credited; the lesson completes once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mountWorkspace({ primitiveId: 'word-flip', evalMode: 'plural_s', data: flip('plural_s') });
  h.say('dog'); h.feedback('incorrect', 'retry');
  expect(h.state().task!.itemId).toBe('a');
  expect(screen.queryByText('dogs')).toBeNull();
  h.say('three dogs'); h.feedback('correct');
  expect(screen.getByText('dogs')).toBeTruthy();
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('b');
  h.say('cats'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ correctCount: 2, totalChallenges: 2, firstTryCount: 1, attemptsCount: 3 });
});

it('a tapped card asks for the source word silently, as the host, never the new word', () => {
  mountWorkspace({ primitiveId: 'word-flip', evalMode: 'plural_s', data: flip('plural_s') });
  fireEvent.click(screen.getByRole('button', { name: 'word dog' }));
  const [text, options] = seam.send.mock.calls.at(-1)!;
  expect(text).toContain('"dog"');
  expect(text).not.toMatch(/\bdogs\b/);
  expect(options).toMatchObject({ silent: true, author: 'host' });
});

it('the adapter refuses a challenge with no answer', () => {
  const broken = { ...flip('plural_s'), challenges: [{ id: 'a', type: 'plural_s', sourceWord: 'dog', answer: '', emoji: '🐕' }] };
  expect(() => LIVE_ADAPTERS['word-flip'].validate(broken)).toThrow();
});
