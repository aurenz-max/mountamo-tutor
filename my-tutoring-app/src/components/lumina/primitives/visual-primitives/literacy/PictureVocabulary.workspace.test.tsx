// @vitest-environment jsdom
/**
 * Picture vocabulary on the teaching workspace: what is its own. The generic W1 contract
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
const RECEPTIVE = { id: 'r', type: 'receptive_match', word: 'dog', emoji: '🐶',
  options: [{ word: 'dog', emoji: '🐶' }, { word: 'sun', emoji: '☀️' }, { word: 'cup', emoji: '☕' }, { word: 'bus', emoji: '🚌' }] };
const BY_MODE: Record<string, { challenge: Record<string, unknown>; spoken: boolean; hidden: string[] }> = {
  receptive_match: { challenge: RECEPTIVE, spoken: false, hidden: ['dog'] },
  naming: { challenge: { id: 'n', type: 'naming', word: 'apple', emoji: '🍎' }, spoken: true, hidden: ['apple'] },
  opposite: { challenge: { id: 'o', type: 'opposite', word: 'small', emoji: '🐭', baseWord: 'big', baseEmoji: '🐘' }, spoken: true, hidden: ['small'] },
  association: { challenge: { id: 'a', type: 'association', word: 'shoe', emoji: '👟', baseWord: 'sock', baseEmoji: '🧦' }, spoken: true, hidden: ['shoe'] },
  gradable_scale: { challenge: { id: 'g', type: 'gradable_scale', word: 'cool', emoji: '🌡️',
    scaleWords: ['freezing', 'cold', 'cool', 'warm', 'hot'], scaleTargetIndex: 2 }, spoken: true, hidden: ['cool'] },
  sentence_frame: { challenge: { id: 's', type: 'sentence_frame', word: 'bed', emoji: '🛏️', frameDisplay: 'We sleep in a ____ at night.',
    frameSpoken: 'We sleep in a hmm at night.' }, spoken: true, hidden: ['bed', '🛏️'] },
};
const data = (mode: string, ...challenges: unknown[]) =>
  ({ title: 'Words', description: '', challengeType: mode, gradeLevel: 'K', challenges }) as unknown as Record<string, unknown>;
const bodyText = () => document.body.textContent ?? '';

it.each(Object.keys(BY_MODE))('%s binds: the spoken key is published, the tap key is not; nothing on screen shows the answer', mode => {
  const { challenge, spoken, hidden } = BY_MODE[mode];
  const d = data(mode, challenge);
  expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'picture-vocabulary', pin: mode, objectiveIds: ['o'], data: d })).not.toBeNull();
  const h = mountWorkspace({ primitiveId: 'picture-vocabulary', evalMode: mode, data: d });
  const workspace = h.state().task!.workspace!;
  if (spoken) expect(workspace.expectedAnswer).toMatch(new RegExp(`\\b${challenge.word}\\b`));
  else expect(workspace.expectedAnswer).toBeUndefined();
  for (const text of hidden) expect(bodyText()).not.toContain(text === '🛏️' ? text : ` ${text}`);
});

it('a wrong card commits a miss that Try again frees; the right card is checked by the activity and completes once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mountWorkspace({ primitiveId: 'picture-vocabulary', evalMode: 'receptive_match', data: data('receptive_match', RECEPTIVE) });
  const card = (word: string) => h.view.container.querySelector(`[data-pip-object="card-${word}"]`) as HTMLElement;
  act(() => { fireEvent.click(card('sun')); });
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: false, response: 'Tapped the picture of sun.' });
  act(() => { fireEvent.click(card('cup')); });
  expect(h.state().task!.workspace!.attempts).toHaveLength(1);
  h.dispatch('retry'); h.confirmVisible();
  act(() => { fireEvent.click(card('dog')); });
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  expect(screen.getByText('dog')).toBeTruthy();
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ correctCount: 1, totalChallenges: 1 });
});

it('association credits an open answer and reveals a mark, never the generated partner', () => {
  const h = mountWorkspace({ primitiveId: 'picture-vocabulary', evalMode: 'association', data: data('association', BY_MODE.association.challenge) });
  h.say('foot'); h.feedback('correct');
  expect(screen.getByText(/They go together/)).toBeTruthy();
  expect(bodyText()).not.toMatch(/\bshoe\b/);
});

it('tapping the stimulus asks for the question silently, as the host, never the answer', () => {
  mountWorkspace({ primitiveId: 'picture-vocabulary', evalMode: 'opposite', data: data('opposite', BY_MODE.opposite.challenge) });
  fireEvent.click(screen.getByText('big'));
  const [text, options] = seam.send.mock.calls.at(-1)!;
  expect(text).toContain('What is the opposite of big?');
  expect(text).not.toMatch(/\bsmall\b/);
  expect(options).toMatchObject({ silent: true, author: 'host' });
});

it('the adapter refuses tap cards that do not contain the target', () => {
  const adapter = LIVE_ADAPTERS['picture-vocabulary'];
  expect(() => adapter.validate(data('receptive_match', { ...RECEPTIVE, options: RECEPTIVE.options.slice(1).concat({ word: 'hat', emoji: '🎩' }) }))).toThrow();
  expect(adapter.validate(data('mixed', ...Object.values(BY_MODE).map(m => m.challenge)))).toBeTruthy();
});
