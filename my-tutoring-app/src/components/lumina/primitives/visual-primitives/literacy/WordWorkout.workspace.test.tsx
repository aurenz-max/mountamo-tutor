// @vitest-environment jsdom
/**
 * Word workout on the teaching workspace: what is its own. The generic W1 contract
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
const data = (mode: string, ...challenges: unknown[]) =>
  ({ title: 'Workout', mode, masteredVowels: ['a', 'i'], gradeLevel: '1', challenges }) as unknown as Record<string, unknown>;
const REAL = { id: 'r', mode: 'real-vs-nonsense', realWord: 'cat', nonsenseWord: 'zat' };
const PIC = { id: 'p', mode: 'picture-match', targetWord: 'pig', targetImage: '🐷',
  distractorImages: [{ word: 'pin', image: '📌' }, { word: 'bin', image: '🗑️' }] };
const CHAIN = { id: 'c', mode: 'word-chains', chain: ['cat', 'bat', 'bad'], changedPositions: [0, 2] };
const SENT = { id: 's', mode: 'sentence-reading', sentence: 'The cat sat on the mat.', cvcWords: ['cat', 'sat', 'mat'],
  sightWords: ['the', 'on'], comprehensionQuestion: 'Where did the cat sit?', comprehensionAnswer: 'mat' };
const INFL = { id: 'i', mode: 'inflected-word', targetWord: 'cats', includeMeaning: true };
const COMP = { id: 'k', mode: 'compound-word', targetWord: 'sunset' };
const CTX = { id: 'x', mode: 'context-discrimination', contextTrialId: 'cat-cap' };
const BY_MODE: Record<string, { data: Record<string, unknown>; spoken: boolean }> = {
  real_vs_nonsense: { data: data('real-vs-nonsense', REAL), spoken: true },
  picture_match: { data: data('picture-match', PIC), spoken: false },
  word_chains: { data: data('word-chains', CHAIN), spoken: true },
  read_inflected: { data: data('inflected-word', INFL), spoken: true },
  read_compound: { data: data('compound-word', COMP), spoken: true },
  choose_in_context: { data: data('context-discrimination', CTX), spoken: true },
  sentence_reading: { data: data('sentence-reading', SENT), spoken: true },
};

it.each(Object.keys(BY_MODE))('%s binds: the spoken key is published, the picture key is not', mode => {
  const { data: d, spoken } = BY_MODE[mode];
  expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'word-workout', pin: mode, objectiveIds: ['o'], data: d })).not.toBeNull();
  const h = mountWorkspace({ primitiveId: 'word-workout', evalMode: mode, data: d });
  const workspace = h.state().task!.workspace!;
  if (spoken) expect(workspace.expectedAnswer).toBeTruthy();
  else expect(workspace.expectedAnswer).toBeUndefined();
  expect(JSON.stringify(h.state().task!.demand)).toMatch(/read|tap/i);
});

it('the ask never names the printed word it asks the learner to read', () => {
  const h = mountWorkspace({ primitiveId: 'word-workout', evalMode: 'word_chains', data: BY_MODE.word_chains.data });
  expect(h.state().task!.task).not.toMatch(/\bcat\b/);
});

it('a wrong picture tap commits a miss that Try again frees; the right tap is checked by the activity and completes once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mountWorkspace({ primitiveId: 'word-workout', evalMode: 'picture_match', data: BY_MODE.picture_match.data });
  const picture = (word: string) => h.view.container.querySelector(`[data-pip-object="picture-${word}"]`) as HTMLElement;
  act(() => { fireEvent.click(picture('pin')); });
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: false, response: 'Tapped the picture of pin.' });
  // A second tap before Try again is not another attempt.
  act(() => { fireEvent.click(picture('bin')); });
  expect(h.state().task!.workspace!.attempts).toHaveLength(1);
  h.dispatch('retry'); h.confirmVisible();
  expect(picture('pin').className).not.toMatch(/incorrect|rose|red/);
  act(() => { fireEvent.click(picture('pig')); });
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ pictureMatchAccuracy: 100, challengesTotal: 1 });
});

it('a chain is one credited read per word, and each read word is marked', () => {
  const h = mountWorkspace({ primitiveId: 'word-workout', evalMode: 'word_chains', data: BY_MODE.word_chains.data });
  h.say('cat'); h.feedback('correct', 'advance'); h.confirmVisible();
  h.say('bat'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(screen.getAllByText('✓')).toHaveLength(2);
  expect(h.state().task!.workspace!.expectedAnswer).toMatch(/^bad\b/);
});

it('hear-again asks for the instruction silently, as the host, never the print', () => {
  mountWorkspace({ primitiveId: 'word-workout', evalMode: 'real_vs_nonsense', data: BY_MODE.real_vs_nonsense.data });
  fireEvent.click(screen.getByRole('button', { name: 'Hear the question again' }));
  const [text, options] = seam.send.mock.calls.at(-1)!;
  expect(text).toContain('Which one is a real word?');
  expect(text).not.toMatch(/\bcat\b|\bzat\b/);
  expect(options).toMatchObject({ silent: true, author: 'host' });
});

it('the adapter refuses a challenge the pack would drop', () => {
  const adapter = LIVE_ADAPTERS['word-workout'];
  expect(() => adapter.validate(data('word-chains', { ...CHAIN, chain: ['cat', 'dog'] }))).toThrow();
  expect(adapter.validate(data('mixed', REAL, PIC, CHAIN, SENT))).toBeTruthy();
});
