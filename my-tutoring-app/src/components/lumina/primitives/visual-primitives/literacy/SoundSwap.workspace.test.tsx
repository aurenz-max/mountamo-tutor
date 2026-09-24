// @vitest-environment jsdom
/**
 * Sound swap on the teaching workspace: what is its own. The generic W1 contract
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
const CHALLENGES: Record<string, Record<string, unknown>> = {
  addition: { operation: 'addition', originalWord: 'an', originalPhonemes: ['/a/', '/n/'], originalImage: 'an',
    addPhoneme: '/p/', addPosition: 'beginning', resultWord: 'pan', resultPhonemes: ['/p/', '/a/', '/n/'], resultImage: 'a pan' },
  deletion: { operation: 'deletion', originalWord: 'cat', originalPhonemes: ['/k/', '/a/', '/t/'], originalImage: 'a cat',
    deletePhoneme: '/k/', deletePosition: 'beginning', resultWord: 'at', resultPhonemes: ['/a/', '/t/'], resultImage: 'at' },
  substitution: { operation: 'substitution', originalWord: 'cat', originalPhonemes: ['/k/', '/a/', '/t/'], originalImage: 'a cat',
    oldPhoneme: '/k/', newPhoneme: '/b/', substitutePosition: 'beginning', resultWord: 'bat', resultPhonemes: ['/b/', '/a/', '/t/'], resultImage: 'a bat' },
};
const swap = (...modes: string[]) => ({ title: 'Swap', gradeLevel: 'K',
  challenges: modes.map((m, i) => ({ ...CHALLENGES[m], id: `c${i}` })) });

it.each(Object.keys(CHALLENGES))('%s binds: the new word is the spoken key and the move names its sound', mode => {
  const data = swap(mode);
  expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'sound-swap', pin: mode, objectiveIds: ['o'], data })).not.toBeNull();
  const h = mountWorkspace({ primitiveId: 'sound-swap', evalMode: mode, data });
  const c = CHALLENGES[mode];
  expect(h.state().task!.workspace!.expectedAnswer).toBe(c.resultWord);
  expect(h.state().task!.task).toMatch(/\/[a-z]+\//);
  expect(h.state().task!.task).not.toMatch(new RegExp(`\\b${c.resultWord}\\b`));
  expect(screen.queryByText(String(c.resultWord))).toBeNull();
});

it('the starting word said back reopens the item; the new word shows once credited; per-operation accuracy is recorded', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mountWorkspace({ primitiveId: 'sound-swap', evalMode: 'mixed', data: swap('substitution', 'addition') });
  h.say('cat'); h.feedback('incorrect', 'retry');
  expect(h.state().task!.itemId).toBe('c0');
  expect(screen.queryByText('bat')).toBeNull();
  h.say('bat'); h.feedback('correct');
  expect(screen.getByText('bat')).toBeTruthy();
  h.dispatch('advance'); h.confirmVisible();
  h.say('pan'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ challengesCorrect: 2, challengesTotal: 2, attemptsCount: 3,
    substitutionAccuracy: 100, additionAccuracy: 100, deletionAccuracy: 0 });
});

it('a tapped sound asks for that sound silently, as the host, never a word', () => {
  mountWorkspace({ primitiveId: 'sound-swap', evalMode: 'substitution', data: swap('substitution') });
  fireEvent.click(screen.getByRole('button', { name: 'sound /k/' }));
  const [text, options] = seam.send.mock.calls.at(-1)!;
  expect(text).toContain('/k/');
  expect(text).not.toMatch(/\b(cat|bat)\b/);
  expect(options).toMatchObject({ silent: true, author: 'host' });
});

it('the adapter refuses a move that does not name its sound', () => {
  const broken = swap('substitution');
  delete (broken.challenges[0] as Record<string, unknown>).newPhoneme;
  expect(() => LIVE_ADAPTERS['sound-swap'].validate(broken)).toThrow();
});
