// @vitest-environment jsdom
/**
 * poetry-lab levers mounted the way a lesson mounts them. A pull changes the screen and the scene fact in one commit
 * and marks no card, choice or word; the next attempt records the lever; a refused pull changes nothing; a practice
 * item is ungraded, shares nothing with the session's, and the full item comes back blank after it.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { act, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { PoetryLabData } from './PoetryLab';
import { modelPoem, practiceFor, rhymeModel } from './poetryLabLevers';
import { poetryHarnessWork, poetryItems } from './poetryLabWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const RHYME: PoetryLabData = {
  title: 'Farm Rhymes', gradeLevel: 'K', mode: 'rhyme_hunt',
  rounds: [{ id: 'rhyme-hunt-1', type: 'rhyme_hunt', poemLines: ['A pig sat in', 'the mud by the log', 'he saw a big', 'and happy dog'],
    candidates: [{ word: 'in', emoji: '📥' }, { word: 'log', emoji: '🪵' }, { word: 'big', emoji: '🐘' }, { word: 'dog', emoji: '🐶' }],
    rhymeWordA: 'log', rhymeWordB: 'dog' }],
};
const POEM_LINES = ['The moon smiled down on the bay', 'The waves were as soft as a song', 'The boats went to sleep for the day', 'And the night wind hummed along'];
const POEM = POEM_LINES.join('\n');
const fig = (text: string, type: string) => ({ text, type, startIndex: POEM.indexOf(text), endIndex: POEM.indexOf(text) + text.length });
const ANALYSIS: PoetryLabData = {
  title: 'Night Harbor', gradeLevel: '4', mode: 'analysis', supportTier: 'hard', poem: POEM, poemLines: POEM_LINES,
  correctMood: 'peaceful', moodOptions: ['peaceful', 'angry', 'scary', 'silly'],
  figurativeInstances: [fig('moon smiled', 'personification'), fig('as soft as a song', 'simile')],
  rhymeScheme: 'ABAB', rhymeSchemeOptions: ['ABAB', 'AABB', 'ABCB'],
};
const HAIKU: PoetryLabData = {
  title: 'Pond Haiku', gradeLevel: '3', mode: 'composition', templateType: 'haiku',
  compositionPrompt: 'Write a haiku about rain on a pond.', templateConstraints: { lineCount: 3, syllablesPerLine: [5, 7, 5] },
};

const mount = (mode: string, data: PoetryLabData) =>
  mountWorkspace({ primitiveId: 'poetry-lab', evalMode: mode, instanceId: 'poetry', data: data as unknown as Record<string, unknown> });
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const advance = (h: WorkspaceHarness) => { h.dispatch('advance'); h.confirmVisible(); };
const write = (h: WorkspaceHarness, lines: readonly string[]) => lines.forEach((text, i) => {
  const input = q(h, 'input').find(el => el.getAttribute('aria-label') === `Line ${i + 1}`)!;
  act(() => { fireEvent.change(input, { target: { value: text } }); });
});

it('rhyme_hunt: a same-start pair pulls the model, which marks no card; a repeat pull changes nothing; the right pair credits with it', () => {
  const h = mount('rhyme_hunt', RHYME);
  expect(levers(h)).toEqual([['rhyme_model', false], ['fewer_cards', false]]);
  h.press('big'); h.press('in');
  expect(nextLever(h.state().task!.workspace!.levers!, attempts(h).at(-1)!.miss)).toBe('rhyme_model');
  const receipt = h.dispatch('pull_lever', { lever: 'rhyme_model' });
  expect(receipt.status).toBe('committed');
  const m = rhymeModel(RHYME)!;
  expect(String(receipt.state.task!.demand.onScreen)).toContain(`${m.words[0].word} and ${m.words[1].word} rhyme`);
  expect(String(receipt.state.task!.demand.onScreen)).not.toMatch(/\b(log|dog)\b/);
  expect(q(h, '[data-lever="rhyme-model"]')).toHaveLength(1);
  const before = h.view.container.innerHTML;
  expect(h.dispatch('pull_lever', { lever: 'rhyme_model' }).status).toBe('blocked');
  expect(h.view.container.innerHTML).toBe(before);
  h.dispatch('retry');
  h.press('log'); h.press('dog');
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, levers: ['rhyme_model'] });
});

it('rhyme_hunt fewer cards: a three-card practice round, ungraded; the full round comes back blank and credits after it', () => {
  const h = mount('rhyme_hunt', RHYME);
  h.press('in'); h.press('big');
  const receipt = h.dispatch('pull_lever', { lever: 'fewer_cards' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('rhyme-hunt-1~simpler');
  const p = practiceFor(poetryItems(RHYME)[0], RHYME)!;
  const cards = q(h, 'button[aria-label]').map(b => b.getAttribute('aria-label'));
  expect(cards.sort()).toEqual(p.item.round!.candidates.map(c => c.word).sort());
  poetryHarnessWork(p.item, p.data, false).picked.forEach(w => h.press(w));
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('rhyme-hunt-1');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'No card tapped yet' });
  h.press('log'); h.press('dog');
  expect(attempts(h).map(x => [x.itemId, x.correct])).toEqual([
    ['rhyme-hunt-1', false], ['rhyme-hunt-1~simpler', true], ['rhyme-hunt-1', true]]);
});

it('analysis: faces on every mood, the phrase count, the end words; none marks the key, and the right answers still credit', () => {
  const h = mount('analysis', ANALYSIS);
  h.press('angry'); h.press(/^Check/);
  expect(h.dispatch('pull_lever', { lever: 'mood_faces' }).status).toBe('committed');
  expect(q(h, 'button[aria-label] span[aria-hidden]')).toHaveLength(4);
  h.dispatch('retry');
  h.press('peaceful'); h.press(/^Check/);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'mood', correct: true, levers: ['mood_faces'] });
  advance(h);
  // Hard tier hides the count; the lever shows it, never where.
  expect(levers(h).map(([id]) => id)).toEqual(['figure_models', 'phrase_count', 'easier_figures']);
  expect(h.dispatch('pull_lever', { lever: 'phrase_count' }).status).toBe('committed');
  expect(h.view.container.textContent).toContain('(2 to find)');
  expect(h.dispatch('pull_lever', { lever: 'figure_models' }).status).toBe('committed');
  expect(q(h, '[data-lever="figure-models"]')[0].textContent).not.toMatch(/moon|smiled|soft as a song/);
  const work = poetryHarnessWork({ id: 'figurative', kind: 'figurative' }, ANALYSIS, false);
  work.tapped.forEach(k => h.touch(k)); h.press(/^Check/);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'figurative', correct: true });
  advance(h);
  h.press('AABB'); h.press(/^Check/);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'aabb_abab' });
  expect(h.dispatch('pull_lever', { lever: 'end_words' }).status).toBe('committed');
  expect(q(h, '[data-lever="end-words"]').map(x => x.textContent)).toEqual(['bay', 'song', 'day', 'along']);
  expect(String(h.state().task!.demand.onScreen)).not.toMatch(/ABAB/);
  h.dispatch('retry');
  h.press('ABAB'); h.press(/^Check/);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'rhyme', correct: true, levers: ['end_words'] });
});

it('composition: the model poem is shown, copying a model line fails, syllable beats count the learner\'s own words', () => {
  const h = mount('composition', HAIKU);
  const right = poetryHarnessWork({ id: 'compose', kind: 'compose' }, HAIKU, false).lines;
  write(h, [right[0], right[1], 'rain']); h.press(/^Check/);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'line_too_short' });
  expect(h.dispatch('pull_lever', { lever: 'model_poem' }).status).toBe('committed');
  const m = modelPoem(HAIKU)!;
  expect(q(h, '[data-lever="model-poem"]')[0].textContent).toContain(m.lines[0]);
  h.dispatch('retry');
  write(h, [m.lines[0], right[1], right[2]]); h.press(/^Check/);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'line_repeated' });
  expect(h.dispatch('pull_lever', { lever: 'syllable_beats' }).status).toBe('committed');
  expect(q(h, '[data-lever="syllable-beats"]').length).toBeGreaterThan(0);
  h.dispatch('retry');
  write(h, right); h.press(/^Check/);
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, levers: ['model_poem', 'syllable_beats'] });
});

it('composition one line: a one-line practice on another subject; the poem comes back blank after it', () => {
  const h = mount('composition', HAIKU);
  write(h, ['sun', '', '']); h.press(/^Check/);
  expect(h.dispatch('pull_lever', { lever: 'one_line' }).status).toBe('committed');
  expect(h.state().task!.itemId).toBe('compose~simpler');
  expect(q(h, 'input')).toHaveLength(1);
  const p = practiceFor({ id: 'compose', kind: 'compose' }, HAIKU)!;
  write(h, poetryHarnessWork(p.item, p.data, false).lines); h.press(/^Check/);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('compose');
  expect(q(h, 'input').map(i => (i as HTMLInputElement).value)).toEqual(['', '', '']);
});
