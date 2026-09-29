// @vitest-environment jsdom
/**
 * The CVC spelling levers on the shared teaching workspace (handoff 22 L1), mounted the way a lesson mounts
 * it. A pull changes the screen and the scene in the same commit and never shows a letter of the word; the
 * practice word is ungraded and gives the full item back blank; only the full item's answer is credited.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { observerLever } from '../../../components/live-activity/runtime/observerLever';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const challenge = (id: string, word: string, emoji = '🐱') => ({ id, taskType: 'spell-word', targetWord: word,
  targetLetters: word.split(''), targetPhonemes: [], emoji, imageDescription: word, distractorLetters: ['m', 'e'] });
const cvc = (supportTier?: string) => ({ title: 'CVC', letterGroup: 2, availableLetters: ['s', 'a', 't', 'i', 'p', 'n'],
  gradeLevel: 'K', supportTier, challenges: [challenge('a', 'cat'), challenge('b', 'pin', '📌')] });
const mount = (supportTier?: string) => mountWorkspace({ primitiveId: 'cvc-speller', evalMode: 'spell_word', data: cvc(supportTier) });
const tap = (letter: string) => fireEvent.click(screen.getByRole('button', { name: `letter ${letter}` }));
const spell = (word: string) => word.split('').forEach(tap);
const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers ?? [];
const bank = () => screen.getAllByRole('button', { name: /^letter / }).map(b => b.textContent);
const q = (h: WorkspaceHarness, sel: string) => h.view.container.querySelectorAll(sel);
const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });

it('declares four levers and publishes no letter of the word', () => {
  const h = mount();
  expect(levers(h).map(l => [l.id, l.pulled])).toEqual([
    ['vowel_keywords', false], ['consonant_keywords', false], ['sound_tokens', false], ['small_word', false]]);
  expect(h.offer('pull_lever')?.assistance).toEqual({ level: 2, answerExposure: 'none' });
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/c a t|\bcat\b/);
});

it('a middle-box miss: the observer pulls the vowel strip, which appears in the same commit, all vowels alike', () => {
  const h = mount();
  spell('cet');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'middle_letter' });
  expect(observerLever(h.state(), true)).toBe('vowel_keywords');
  expect(q(h, '[data-lever="vowel-strip"]')).toHaveLength(0);
  const receipt = h.dispatch('pull_lever', { lever: 'vowel_keywords' });
  expect(receipt.status).toBe('committed');
  const strip = Array.from(q(h, '[data-lever="vowel-strip"] > div')).map(d => d.textContent);
  expect(strip).toEqual(['🍎a', '🥚e', '🤏i']);
  expect(String(receipt.state.task!.demand.levers_on_screen)).toMatch(/every vowel/);
  // A second pull is refused and changes nothing.
  const assistance = h.state().assistance.length;
  expect(h.dispatch('pull_lever', { lever: 'vowel_keywords' }).status).toBe('blocked');
  expect(h.state().assistance).toHaveLength(assistance);

  h.dispatch('retry');
  tap('a');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ itemId: 'a', correct: true, assisted: true, levers: ['vowel_keywords'] });
  h.close();
});

it('consonant keywords sit under every consonant, and never picture the item: c is a car on a "cat" item', () => {
  const h = mount();
  spell('mat');
  h.dispatch('pull_lever', { lever: 'consonant_keywords' });
  const pictures = Array.from(q(h, '[data-lever="bank-keyword"]')).map(k => k.getAttribute('aria-label'));
  expect(pictures.sort()).toEqual(['car', 'moon', 'tent']);
  expect(pictures).not.toContain('cat');
  h.close();
});

it('sound tokens are blank and move only on the learner\'s taps, left to right', () => {
  const h = mount();
  spell('tac');
  expect(observerLever(h.state(), true)).toBe('sound_tokens');
  h.dispatch('pull_lever', { lever: 'sound_tokens' });
  h.dispatch('retry');
  const tokens = () => Array.from(q(h, '[data-lever-token]')).map(t => t.getAttribute('data-lever-token'));
  expect(tokens()).toEqual(['waiting', 'waiting', 'waiting']);
  expect(Array.from(q(h, '[data-lever="sound-tokens"]')).map(t => t.textContent)).toEqual(['']);
  fireEvent.click(screen.getByRole('button', { name: 'sound token 2' }));      // out of order: nothing moves
  expect(tokens()).toEqual(['waiting', 'waiting', 'waiting']);
  fireEvent.click(screen.getByRole('button', { name: 'sound token 1' }));
  expect(tokens()).toEqual(['pushed', 'waiting', 'waiting']);
  expect(h.state().task!.demand.tokens_pushed).toBe('1 of 3');
  h.close();
});

it('the practice word is ungraded with a four-letter bank; the full item comes back blank and is credited', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount();
  spell('met');
  h.dispatch('pull_lever', { lever: 'sound_tokens' });
  h.dispatch('retry');
  spell('me');                                                        // Try again kept the t: "met" again
  expect(observerLever(h.state(), true)).toBe('small_word');
  h.dispatch('pull_lever', { lever: 'small_word' });
  expect(h.state().task).toMatchObject({ itemId: 'a~simpler' });
  expect(h.state().task!.workspace!.practice).toEqual({ returnsTo: 'a' });
  expect(bank().sort()).toEqual(['a', 'm', 'p', 's']);
  expect(q(h, '[data-lever="sound-tokens"]')).toHaveLength(0);
  // Hear It says the practice word.
  fireEvent.click(screen.getByRole('button', { name: 'hear the word' }));
  expect(seam.send.mock.calls.at(-1)![0]).toContain('"map"');
  spell('sap');
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: false });
  // Try again on the practice word keeps the practice word and its right letters.
  h.dispatch('retry');
  expect(h.state().task).toMatchObject({ itemId: 'a~simpler' });
  expect([1, 2, 3].map(n => screen.getByRole('button', { name: `box ${n}` }).textContent)).toEqual(['?', 'a', 'p']);
  tap('m');
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'a' });
  expect([1, 2, 3].map(n => screen.getByRole('button', { name: `box ${n}` }).textContent)).toEqual(['?', '?', '?']);
  spell('cat');
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['a', false, false], ['a', false, false], ['a~simpler', false, true], ['a~simpler', true, true], ['a', true, false]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: ['sound_tokens', 'small_word'] });
  h.dispatch('advance'); h.confirmVisible();
  spell('pin');
  h.dispatch('advance'); h.confirmVisible();
  await flushScoring();
  // The practice word stays out of the metrics: the session error only, never "sap".
  expect(seam.submit.mock.calls.at(-1)![2]).toMatchObject({ wordsSpelledCorrectly: 2, commonErrors: ['met'] });
  h.close();
});

it('easy starts with the vowel strip up, and that is not a pull', () => {
  const h = mount('easy');
  expect(levers(h).find(l => l.id === 'vowel_keywords')!.pulled).toBe(true);
  expect(q(h, '[data-lever="vowel-strip"]')).toHaveLength(1);
  spell('cat');
  expect(h.state().task!.workspace!.attempts.at(-1)!.levers).toBeUndefined();
  h.close();
});

it.each(['fill_vowel', 'word_sort'])('%s: middle_model lights the middle of another word; its sound is none the session asks', evalMode => {
  const taskType = evalMode === 'fill_vowel' ? 'fill-vowel' : 'word-sort';
  const words = [['a', 'cat', '🐱'], ['b', 'bed', '🛏️'], ['c', 'pig', '🐷'], ['d', 'dog', '🐶'], ['e', 'sun', '☀️']];
  const h = mountWorkspace({ primitiveId: 'cvc-speller', evalMode, data: { ...cvc(), gradeLevel: '1',
    challenges: words.map(([id, word, emoji]) => ({ ...challenge(id, word, emoji), taskType })) } });
  expect(levers(h).map(l => [l.id, l.pulled])).toEqual([['middle_model', false]]);
  h.say('cat'); h.feedback('incorrect', 'retry');
  expect(q(h, '[data-lever="middle-model"]')).toHaveLength(0);
  const receipt = h.dispatch('pull_lever', { lever: 'middle_model' });
  expect(receipt.status).toBe('committed');
  const boxes = Array.from(q(h, '[data-lever="middle-model"] [data-box]')).map(b => b.textContent);
  expect(Array.from(q(h, '[data-lever="middle-model"] [data-lit]')).map(b => b.getAttribute('data-box'))).toEqual(['1']);
  // Every short vowel is asked, so the model's middle is a vowel team, never a short vowel letter.
  expect(['ai', 'ee', 'ea', 'oa']).toContain(boxes[1]);
  const word = q(h, '[data-lever="middle-model"] [role="img"]')[0].getAttribute('aria-label')!;
  expect(['cat', 'bed', 'pig', 'dog', 'sun']).not.toContain(word);
  expect(String(receipt.state.task!.demand.levers_on_screen)).toMatch(new RegExp(`another word, ${word}`));
  // Its only lever is up, so pull_lever is no longer offered.
  expect(h.offer('pull_lever')).toBeUndefined();
  h.say('ah'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ itemId: 'a', correct: true, assisted: true, levers: ['middle_model'] });
  h.close();
});
