// @vitest-environment jsdom
/**
 * Letter spotter on the teaching workspace: what is its own. The generic W1 contract
 * (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 * The first-response gate and confusion pairs are pinned in LetterSpotter.capture.test.tsx.
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
import { SPOTTER_EMOJI } from './letterSpotterScript';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const NAME = { id: 'name', mode: 'name-it', targetLetter: 'a', targetCase: 'lowercase', targetWord: 'ant',
  spokenSentence: 'I see an ant walk away.', sentence: `I see an ${SPOTTER_EMOJI}nt walk away.` };
const FIND = { id: 'find', mode: 'find-it', targetLetter: 'p', targetCase: 'uppercase',
  letterGrid: ['S', 'A', 'T', 'I', 'N', 'P', 'S', 'A', 'T', 'I', 'N', 'S', 'A', 'T', 'I', 'N'] };
const MATCH = { id: 'match', mode: 'match-it', targetLetter: 's', targetCase: 'both', options: ['s', 'a', 'n', 't'] };
const data = (...challenges: unknown[]) => ({ title: 'Letters', letterGroup: 1, cumulativeLetters: ['s', 'a', 't', 'p', 'i', 'n'],
  newLetters: [], gradeLevel: 'K', challenges }) as unknown as Record<string, unknown>;
const BY_MODE: Record<string, { challenge: unknown; spoken: boolean }> = {
  name_it: { challenge: NAME, spoken: true }, find_it: { challenge: FIND, spoken: false }, match_it: { challenge: MATCH, spoken: false },
};

it.each(Object.keys(BY_MODE))('%s binds: the spoken key is published, the tap key is not', mode => {
  const d = data(BY_MODE[mode].challenge);
  expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'letter-spotter', pin: mode, objectiveIds: ['o'], data: d })).not.toBeNull();
  const h = mountWorkspace({ primitiveId: 'letter-spotter', evalMode: mode, data: d });
  const workspace = h.state().task!.workspace!;
  if (BY_MODE[mode].spoken) expect(workspace.expectedAnswer).toMatch(/^The letter A, the first letter of ant/);
  else expect(workspace.expectedAnswer).toBeUndefined();
});

it('name it hides the letter behind the star until credit', () => {
  const h = mountWorkspace({ primitiveId: 'letter-spotter', evalMode: 'name_it', data: data(NAME) });
  expect(screen.getByLabelText('hidden letter')).toBeTruthy();
  h.say('B'); h.feedback('incorrect', 'retry'); h.confirmVisible();
  expect(screen.getByLabelText('hidden letter')).toBeTruthy();
  h.say('A'); h.feedback('correct');
  expect(screen.queryByLabelText('hidden letter')).toBeNull();
});

it('match it never names the big letter in the ask; a wrong tap is a miss, a second tap before Try again is not an attempt', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mountWorkspace({ primitiveId: 'letter-spotter', evalMode: 'match_it', data: data(MATCH) });
  expect(h.state().task!.task).not.toMatch(/\bS\b/);
  const option = (l: string) => h.view.container.querySelector(`[data-pip-object="option-${l}"]`) as HTMLElement;
  act(() => { fireEvent.click(option('n')); });
  act(() => { fireEvent.click(option('a')); });
  expect(h.state().task!.workspace!.attempts).toHaveLength(1);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: false, response: 'Tapped the letter n.' });
  h.dispatch('retry'); h.confirmVisible();
  act(() => { fireEvent.click(option('s')); });
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ confusedLetterPairs: ['n-s'] });
});

it('the adapter refuses a find-it grid without exactly one target', () => {
  const adapter = LIVE_ADAPTERS['letter-spotter'];
  expect(() => adapter.validate(data({ ...FIND, letterGrid: FIND.letterGrid.map(l => (l === 'P' ? 'S' : l)) }))).toThrow();
  expect(adapter.validate(data(NAME, FIND, MATCH))).toBeTruthy();
});
