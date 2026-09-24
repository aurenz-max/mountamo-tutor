// @vitest-environment jsdom
/**
 * CVC speller on the teaching workspace: what is its own. The generic W1 contract
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
const TASK = { fill_vowel: 'fill-vowel', spell_word: 'spell-word', word_sort: 'word-sort' } as const;
const challenge = (id: string, taskType: string, word: string) => ({ id, taskType, targetWord: word,
  targetLetters: word.split(''), targetPhonemes: [], emoji: '🐱', imageDescription: word, distractorLetters: ['m', 'e'] });
const cvc = (...items: ReturnType<typeof challenge>[]) => ({ title: 'CVC', letterGroup: 2, availableLetters: [], gradeLevel: 'K', challenges: items });
const tap = (letter: string) => fireEvent.click(screen.getByRole('button', { name: `letter ${letter}` }));

it.each(Object.entries(TASK))('%s binds: a spoken mode publishes the middle sound, the spelling never', (mode, task) => {
  const data = cvc(challenge('a', task, 'cat'));
  expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'cvc-speller', pin: mode, objectiveIds: ['o'], data })).not.toBeNull();
  const h = mountWorkspace({ primitiveId: 'cvc-speller', evalMode: mode, data });
  const key = h.state().task!.workspace!.expectedAnswer;
  if (task === 'spell-word') expect(key).toBeUndefined();
  else expect(key).toContain('aaa');
  expect(screen.queryByText('a', { selector: '[data-pip-object="gap"]' })).toBeNull();
});

it('spell-word: the third letter commits; a wrong build keeps its right letters on Try again; a right one completes', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mountWorkspace({ primitiveId: 'cvc-speller', evalMode: 'spell_word', data: cvc(challenge('a', 'spell-word', 'cat')) });
  tap('m'); tap('a');
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  tap('t');
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(seam.send.mock.calls.at(-1)![0]).toContain('m a t');
  h.dispatch('retry');
  const boxes = () => [1, 2, 3].map(n => screen.getByRole('button', { name: `box ${n}` }).textContent);
  expect(boxes()).toEqual(['?', 'a', 't']);
  tap('c');
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ wordsSpelledCorrectly: 1, commonErrors: ['mat'], vowelAccuracy: 100 });
});

it('fill-vowel: the blank stays a blank until the middle sound is credited', () => {
  const h = mountWorkspace({ primitiveId: 'cvc-speller', evalMode: 'fill_vowel', data: cvc(challenge('a', 'fill-vowel', 'cat')) });
  const gap = () => h.view.container.querySelector('[data-pip-object="gap"]')!.textContent;
  expect(gap()).toBe('?');
  h.say('cat'); h.feedback('incorrect', 'retry');
  expect(gap()).toBe('?');
  h.say('aaa'); h.feedback('correct');
  expect(gap()).toBe('a');
});

it('Hear It asks for the whole word silently, as the host', () => {
  mountWorkspace({ primitiveId: 'cvc-speller', evalMode: 'fill_vowel', data: cvc(challenge('a', 'fill-vowel', 'cat')) });
  fireEvent.click(screen.getByRole('button', { name: 'hear the word' }));
  const [text, options] = seam.send.mock.calls.at(-1)!;
  expect(text).toContain('"cat"');
  expect(options).toMatchObject({ silent: true, author: 'host' });
});

it('the adapter refuses a word whose middle letter is not a vowel', () => {
  expect(() => LIVE_ADAPTERS['cvc-speller'].validate(cvc(challenge('a', 'fill-vowel', 'cst')))).toThrow();
});
