// @vitest-environment jsdom
/**
 * Phonics blender on the teaching workspace: what is its own. The generic W1 contract
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
const word = (id: string, targetWord: string, emoji?: string) => ({ id, targetWord, emoji,
  phonemes: targetWord.split('').map((letters, i) => ({ id: `${id}-${i}`, sound: `/${letters}/`, letters })) });
const DATA = { title: 'Blend', gradeLevel: 'K', patternType: 'cvc',
  words: [word('w1', 'cat', '🐱'), word('w2', 'dog', '🐶')] } as unknown as Record<string, unknown>;

it.each(['cvc', 'cvce_blend', 'digraph', 'advanced', 'mixed'])('%s binds: every item is the spoken word', mode => {
  expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'phonics-blender', pin: mode, objectiveIds: ['o'], data: DATA })).not.toBeNull();
  const h = mountWorkspace({ primitiveId: 'phonics-blender', evalMode: mode, data: DATA });
  expect(h.state().task!.workspace!.expectedAnswer).toBe('cat');
  expect(h.state().task!.task).not.toContain('cat');
});

it('a wrong word reopens the item with no picture; a right one shows it; the lesson completes once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mountWorkspace({ primitiveId: 'phonics-blender', evalMode: 'cvc', data: DATA });
  h.say('cap'); h.feedback('incorrect', 'retry');
  expect(h.state().task!.itemId).toBe('w1');
  expect(screen.queryByText('🐱')).toBeNull();
  h.say('cat'); h.feedback('correct');
  expect(screen.getByText('🐱')).toBeTruthy();
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('w2');
  expect(screen.queryByText('🐱')).toBeNull();
  h.say('dog'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
  const [passed, score, metrics] = seam.submit.mock.calls[0];
  expect([passed, score]).toEqual([true, 84]);
  expect(metrics).toMatchObject({ wordsBlended: 2, wordsTotal: 2, soundsCorrectOnFirstTry: 1 });
});

it('a tapped letter asks for its sound silently, as the host, never the word', () => {
  mountWorkspace({ primitiveId: 'phonics-blender', evalMode: 'cvc', data: DATA });
  fireEvent.click(screen.getByRole('button', { name: 'sound /c/' }));
  const [text, options] = seam.send.mock.calls.at(-1)!;
  expect(text).toContain('/c/');
  expect(text).not.toMatch(/\bcat\b/);
  expect(options).toMatchObject({ silent: true, author: 'host' });
});

it('the adapter refuses a word with no letters', () => {
  const broken = { ...DATA, words: [{ id: 'w1', targetWord: 'cat', phonemes: [] }] };
  expect(() => LIVE_ADAPTERS['phonics-blender'].validate(broken)).toThrow();
});
