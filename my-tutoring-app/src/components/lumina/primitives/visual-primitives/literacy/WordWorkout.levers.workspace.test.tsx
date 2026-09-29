// @vitest-environment jsdom
/**
 * The picture-match levers on the shared teaching workspace (handoff 22 L1), mounted the way a lesson mounts
 * it. The dots change the printed word in the same commit and nothing is said; the practice item is ungraded
 * and gives the full item back; only the full item's tap is credited.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { observerLever } from '../../../components/live-activity/runtime/observerLever';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const PIC = { id: 'p', mode: 'picture-match', targetWord: 'pig', targetImage: '🐷',
  distractorImages: [{ word: 'pin', image: '📌' }, { word: 'bin', image: '🗑️' }] };
const mount = () => mountWorkspace({ primitiveId: 'word-workout', evalMode: 'picture_match',
  data: { title: 'Workout', mode: 'picture-match', masteredVowels: ['a', 'i'], gradeLevel: '1', challenges: [PIC] } });
const picture = (h: WorkspaceHarness, word: string) => act(() => {
  fireEvent.click(h.view.container.querySelector(`[data-pip-object="picture-${word}"]`) as HTMLElement);
});
const pictures = (h: WorkspaceHarness) => Array.from(h.view.container.querySelectorAll('[data-pip-object^="picture-"]'))
  .map(p => p.getAttribute('data-pip-object')!.slice('picture-'.length));

it('a same-start tap: the observer pulls the dots, one per sound, and nothing is said', () => {
  const h = mount();
  expect(h.state().task!.workspace!.levers!.map(l => l.id)).toEqual(['sound_dots', 'two_far_pictures']);
  picture(h, 'pin');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'same_start' });
  expect(observerLever(h.state(), true)).toBe('sound_dots');
  const sent = seam.send.mock.calls.length;
  const receipt = h.dispatch('pull_lever', { lever: 'sound_dots' });
  expect(receipt.status).toBe('committed');
  expect(h.view.container.querySelectorAll('[data-sound-dot]')).toHaveLength(3);
  expect(h.view.container.querySelector('[data-lever="sound-dots"]')!.textContent).toContain('pig');
  expect(seam.send.mock.calls.length).toBe(sent);
  expect(JSON.stringify(receipt.state.task!.demand)).not.toMatch(/\bpig\b/);
  h.dispatch('retry');
  picture(h, 'pig');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['sound_dots'] });
  h.close();
});

it('the practice item is ungraded, survives Try again, and gives the full item back', () => {
  const h = mount();
  picture(h, 'bin');
  h.dispatch('pull_lever', { lever: 'two_far_pictures' });
  expect(h.state().task).toMatchObject({ itemId: 'p~simpler' });
  expect(h.view.container.querySelector('[data-pip-object="word"]')!.textContent).toBe('map');
  expect(pictures(h)).toEqual(['fan', 'map']);
  picture(h, 'fan');
  h.dispatch('retry');
  expect(h.state().task).toMatchObject({ itemId: 'p~simpler' });
  picture(h, 'map');
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'p' });
  expect(pictures(h).sort()).toEqual(['bin', 'pig', 'pin']);
  picture(h, 'pig');
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['p', false, false], ['p~simpler', false, true], ['p~simpler', true, true], ['p', true, false]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: ['two_far_pictures'] });
  h.close();
});

// ── L3: the spoken read modes (handoff 22) ──────────────────────────────────
const spoken = (evalMode: string, mode: string, challenge: Record<string, unknown>) => mountWorkspace({ primitiveId: 'word-workout', evalMode,
  data: { title: 'Workout', mode, masteredVowels: ['a', 'o'], gradeLevel: '1', challenges: [{ id: 'x', mode, ...challenge }] } });
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));

it('real or silly: dots under both words in one commit, nothing said, the next read carries the lever', () => {
  const h = spoken('real_vs_nonsense', 'real-vs-nonsense', { realWord: 'pig', nonsenseWord: 'zog' });
  h.say('zog'); h.feedback('incorrect', 'retry');
  const sent = seam.send.mock.calls.length;
  const receipt = h.dispatch('pull_lever', { lever: 'sound_dots' });
  expect(receipt.status).toBe('committed');
  expect(q(h, '[data-sound-dot]')).toHaveLength(6);
  expect(seam.send.mock.calls.length).toBe(sent);
  expect(JSON.stringify(receipt.state.task!.demand)).not.toMatch(/\bpig\b|\bzog\b/);
  h.say('pig'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['sound_dots'] });
  h.close();
});

it('word chains: the changed letter lights on the lit word; the short chain is ungraded and gives the chain back', () => {
  const h = spoken('word_chains', 'word-chains', { chain: ['cat', 'hat', 'hot'], chainCueLevel: 'none' });
  h.say('cat'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task).toMatchObject({ itemId: 'x-w2' });
  expect(q(h, '[data-lever="changed-letter"]')).toHaveLength(0);
  h.dispatch('pull_lever', { lever: 'changed_letter' });
  expect(q(h, '[data-lever="changed-letter"]').map(e => e.textContent)).toEqual(['h']);
  h.say('cat'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'short_chain' });
  expect(h.state().task).toMatchObject({ itemId: 'x-w2~simpler' });
  const text = h.view.container.textContent ?? '';
  expect(text).not.toMatch(/cat|hat|hot/);
  h.say('practice'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task).toMatchObject({ itemId: 'x-w2' });
  h.say('hat'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.map(a => [a.itemId, a.correct])).toEqual([
    ['x-w1', true], ['x-w2', false], ['x-w2~simpler', true], ['x-w2', true]]);
  h.close();
});

it('inflected: the divider splits the base from its ending; the easier word is a new -s word', () => {
  const h = spoken('read_inflected', 'inflected-word', { targetWord: 'jumping' });
  expect(h.dispatch('pull_lever', { lever: 'chunk_divider' }).status).not.toBe('committed');
  expect(h.view.container.querySelector('[data-lever="chunk-divider"]')).toBeNull();
  h.say('jump'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'chunk_divider' });
  const word = h.view.container.querySelector('[data-print-word]')!;
  expect(word.textContent).toBe('jumping');
  expect(word.querySelector('[data-lever="chunk-divider"]')!.previousElementSibling!.textContent).toBe('p');
  h.say('jump'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'easier_ending' });
  expect(h.state().task).toMatchObject({ itemId: 'x-read~simpler' });
  expect(h.view.container.textContent).toMatch(/cats/);
  expect(h.view.container.textContent).not.toMatch(/jump/);
  h.close();
});

it('sentence reading: one underline per word, nothing said; the practice sentence shares no word; the question icon', () => {
  const h = spoken('sentence_reading', 'sentence-reading', { sentence: 'The cat sat on the mat.', cvcWords: ['cat', 'sat', 'mat'],
    comprehensionQuestion: 'Where did the cat sit?', comprehensionAnswer: 'mat' });
  const sent = seam.send.mock.calls.length;
  h.dispatch('pull_lever', { lever: 'tracking_underline' });
  expect(q(h, '[data-track-segment]')).toHaveLength(6);
  expect(seam.send.mock.calls.length).toBe(sent);
  h.say('The cat sat on a mat.'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'three_word_sentence' });
  expect(h.state().task).toMatchObject({ itemId: 'x-read~simpler' });
  expect(h.view.container.textContent).not.toMatch(/\b(the|cat|sat|on|mat)\b/i);
  h.say('Sam can hop.'); h.feedback('correct', 'advance'); h.confirmVisible();
  h.say('The cat sat on the mat.'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task).toMatchObject({ itemId: 'x-q' });
  h.dispatch('pull_lever', { lever: 'question_word_icon' });
  expect(q(h, '[data-lever="question-icon"]').map(e => e.getAttribute('aria-label'))).toEqual(['a place']);
  expect(h.view.container.querySelector('[data-lever="question-icon"]')!.parentElement!.textContent).not.toMatch(/\bmat\b/);
  h.close();
});
