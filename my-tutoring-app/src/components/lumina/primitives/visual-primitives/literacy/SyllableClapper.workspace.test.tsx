// @vitest-environment jsdom
/**
 * Syllable clapper on the teaching workspace: what is its own. The generic W1 contract
 * (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 * Nothing on screen may equal what the child is about to say: the word, its parts and the
 * count appear only in the reveal, which a credit opens.
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
const word = (id: string, w: string, syllables: string[], challengeType: string, extra: Record<string, unknown> = {}) =>
  ({ id, word: w, syllables, syllableCount: syllables.length, imageDescription: `a ${w}`, difficulty: 3, challengeType, ...extra });
const data = (...challenges: unknown[]) => ({ title: 'Clap It Out', challenges }) as unknown as Record<string, unknown>;
const COUNT = data(word('c1', 'butterfly', ['but', 'ter', 'fly'], 'count_parts'), word('c2', 'tiger', ['ti', 'ger'], 'count_parts'));
const BY_MODE: Record<string, { data: Record<string, unknown>; answer: string; hidden: string[] }> = {
  count_parts: { data: COUNT, answer: 'three', hidden: ['butterfly', 'three', '3'] },
  blend_syllables: { data: data(word('b1', 'rabbit', ['rab', 'bit'], 'blend_syllables')), answer: 'rabbit', hidden: ['rabbit', 'rab', 'bit'] },
  delete_compound: { data: data(word('d1', 'cupcake', ['cup', 'cake'], 'delete_compound', { removePart: 'cup', residue: 'cake' })),
    answer: 'cake', hidden: ['cupcake', 'cake'] },
};
const bodyText = () => document.body.textContent ?? '';

it.each(Object.keys(BY_MODE))('%s binds: one spoken answer, and nothing on screen equals it', mode => {
  const { data: d, answer, hidden } = BY_MODE[mode];
  expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'syllable-clapper', pin: mode, objectiveIds: ['o'], data: d })).not.toBeNull();
  const h = mountWorkspace({ primitiveId: 'syllable-clapper', evalMode: mode, data: d });
  const assignment = h.state().task!.workspace!;
  expect(assignment.expectedAnswer).toMatch(new RegExp(`^${answer}\\b`));
  // The ask states the stimulus (a compound contains its residue) but never the answer as a word of its own.
  expect(h.state().task!.task).not.toMatch(new RegExp(`\\b${answer}\\b`));
  for (const text of hidden) expect(bodyText()).not.toMatch(new RegExp(`\\b${text}\\b`, 'i'));
  expect(screen.queryByTestId('reveal')).toBeNull();
});

it('the voicing fact inverts between the acts: parts on blend, joined on count', () => {
  const blend = mountWorkspace({ primitiveId: 'syllable-clapper', evalMode: 'blend_syllables', data: BY_MODE.blend_syllables.data });
  expect(String(blend.state().task!.demand?.voicing)).toMatch(/one at a time/);
  cleanup();
  const count = mountWorkspace({ primitiveId: 'syllable-clapper', evalMode: 'count_parts', data: COUNT });
  expect(String(count.state().task!.demand?.voicing)).toMatch(/one joined word/);
});

it('a wrong count reopens the item with no reveal; a right one reveals the split; the lesson completes once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mountWorkspace({ primitiveId: 'syllable-clapper', evalMode: 'count_parts', data: COUNT });
  h.say('four'); h.feedback('incorrect', 'retry');
  expect(h.state().task!.itemId).toBe('c1');
  expect(screen.queryByTestId('reveal')).toBeNull();
  h.say('three'); h.feedback('correct');
  expect(screen.getByTestId('reveal').textContent).toContain('butterfly — three parts');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('c2');
  h.say('two'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ evalMode: 'count_parts', wordsCorrect: 2, wordsTotal: 2 });
});

it('hear-again asks for the question silently, as the host, never the answer', () => {
  mountWorkspace({ primitiveId: 'syllable-clapper', evalMode: 'count_parts', data: COUNT });
  fireEvent.click(screen.getByTestId('hear-word'));
  const [text, options] = seam.send.mock.calls.at(-1)!;
  expect(text).toContain('how many parts in butterfly.');
  expect(text).not.toMatch(/\bthree\b/);
  expect(options).toMatchObject({ silent: true, author: 'host' });
});

it('the adapter refuses a word the pack would drop, and a word asked twice', () => {
  const adapter = LIVE_ADAPTERS['syllable-clapper'];
  expect(() => adapter.validate(data(word('x', 'squirrel', ['squir', 'rel'], 'count_parts')))).toThrow();
  expect(() => adapter.validate(data(word('x', 'tiger', ['ti', 'ger'], 'count_parts'), word('y', 'tiger', ['ti', 'ger'], 'blend_syllables')))).toThrow();
  expect(adapter.validate(COUNT)).toBeTruthy();
});
