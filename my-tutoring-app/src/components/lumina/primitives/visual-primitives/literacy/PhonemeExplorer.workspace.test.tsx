// @vitest-environment jsdom
/**
 * Phoneme explorer on the teaching workspace: what is its own. The generic W1 contract
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
const data = (...challenges: unknown[]) => ({ title: 'Sounds', gradeLevel: 'K', challenges }) as unknown as Record<string, unknown>;
const menu = (right: string, ...wrong: string[]) => [{ word: right, emoji: '⭐', correct: true }, ...wrong.map(w => ({ word: w, emoji: '⭐', correct: false }))];
const BY_MODE: Record<string, { challenge: Record<string, unknown>; answer: string; hidden: string[] }> = {
  isolate: { challenge: { id: 'i', mode: 'isolate', phoneme: 'M', phonemeSound: 'mmm', exampleWord: 'mouse', choices: menu('moon', 'dog', 'fish', 'cake') },
    answer: 'moon', hidden: [] },
  ending: { challenge: { id: 'e', mode: 'ending', targetWord: 'cap', targetEmoji: '🧢', finalPhoneme: 'p', choices: menu('mop', 'cat', 'sun', 'dog') },
    answer: 'mop', hidden: ['cap', 'mop'] },
  medial: { challenge: { id: 'm', mode: 'medial', targetWord: 'cat', targetEmoji: '🐱', vowel: 'a', choices: menu('hat', 'hot', 'hit', 'hut') },
    answer: 'hat', hidden: ['cat'] },
  blend: { challenge: { id: 'b', mode: 'blend', phonemeSequence: ['k', 'a', 't'], word: 'cat', emoji: '🐱' }, answer: 'cat', hidden: ['cat'] },
  segment: { challenge: { id: 's', mode: 'segment', targetWord: 'sheep', targetEmoji: '🐑', segments: ['sh', 'ee', 'p'] },
    answer: 'three', hidden: ['sheep', 'three'] },
  manipulate: { challenge: { id: 'x', mode: 'manipulate', originalWord: 'cat', originalEmoji: '🐱', operation: 'substitute',
    operationDescription: "Change the /k/ in 'cat' to /b/", resultWord: 'bat', resultEmoji: '🦇' }, answer: 'bat', hidden: ['bat'] },
};
const bodyText = () => document.body.textContent ?? '';

it.each(Object.keys(BY_MODE))('%s binds: one spoken answer judged against the key, nothing on screen names it', mode => {
  const { challenge, answer, hidden } = BY_MODE[mode];
  const d = data(challenge);
  expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'phoneme-explorer', pin: mode, objectiveIds: ['o'], data: d })).not.toBeNull();
  const h = mountWorkspace({ primitiveId: 'phoneme-explorer', evalMode: mode, data: d });
  expect(h.state().task!.workspace!.expectedAnswer).toMatch(new RegExp(`^${answer}\\b`));
  for (const text of hidden) expect(bodyText()).not.toMatch(new RegExp(`\\b${text}\\b`, 'i'));
});

it('a wrong count reopens with no reveal; a right one reveals the count; the lesson completes once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mountWorkspace({ primitiveId: 'phoneme-explorer', evalMode: 'segment', data: data(BY_MODE.segment.challenge, BY_MODE.blend.challenge) });
  h.say('four'); h.feedback('incorrect', 'retry');
  expect(h.state().task!.itemId).toBe('s');
  expect(bodyText()).not.toMatch(/sheep/);
  h.say('three'); h.feedback('correct');
  expect(bodyText()).toContain('sheep — three sounds');
  h.dispatch('advance'); h.confirmVisible();
  h.say('cat'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ challengesCorrect: 2, challengesTotal: 2 });
});

it('a tapped card or tile asks for that word or sound silently, as the host', () => {
  mountWorkspace({ primitiveId: 'phoneme-explorer', evalMode: 'blend', data: data(BY_MODE.blend.challenge) });
  fireEvent.click(screen.getByText('/a/'));
  const [text, options] = seam.send.mock.calls.at(-1)!;
  expect(text).toMatch(/^The learner tapped a sound\./);
  expect(text).not.toMatch(/\bcat\b/);
  expect(options).toMatchObject({ silent: true, author: 'host' });
});

it('the adapter refuses an item the pack would drop', () => {
  const adapter = LIVE_ADAPTERS['phoneme-explorer'];
  expect(() => adapter.validate(data({ ...BY_MODE.isolate.challenge, choices: menu('mouse', 'dog', 'fish', 'cake') }))).toThrow();
  expect(adapter.validate(data(...Object.values(BY_MODE).map(m => m.challenge)))).toBeTruthy();
});
