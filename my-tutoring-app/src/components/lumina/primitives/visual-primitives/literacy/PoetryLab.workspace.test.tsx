// @vitest-environment jsdom
/**
 * Poetry lab on the teaching workspace (W1, plain shape): what is its own. Every catalog mode binds on hand-built
 * content; no key (the rhyming pair, the mood, the figurative words, the scheme) reaches the tutor; a wrong check
 * commits its named miss, stays closed, and Try again reopens it; the last right check completes once. The generic
 * W1 contract runs in `runtime/workspaceContract.test.tsx`.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { act, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import type { PoetryLabData } from './PoetryLab';
import { EMPTY_VIEW, poemWords, poetryHarnessWork, poetryItems, poetryMiss, rhymeCards } from './poetryLabWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const RHYME: PoetryLabData = {
  title: 'Farm Rhymes', gradeLevel: 'K', mode: 'rhyme_hunt',
  rounds: [
    { id: 'rhyme-hunt-1', type: 'rhyme_hunt', poemLines: ['A pig sat in', 'the mud by the log', 'he saw a big', 'and happy dog'],
      candidates: [{ word: 'in', emoji: '📥' }, { word: 'log', emoji: '🪵' }, { word: 'big', emoji: '🐘' }, { word: 'dog', emoji: '🐶' }],
      rhymeWordA: 'log', rhymeWordB: 'dog' },
    { id: 'rhyme-hunt-2', type: 'rhyme_hunt', poemLines: ['The cow went out', 'to see the cat', 'it ran so far', 'and found a hat'],
      candidates: [{ word: 'out', emoji: '🚪' }, { word: 'cat', emoji: '🐱' }, { word: 'far', emoji: '🛣️' }, { word: 'hat', emoji: '🎩' }],
      rhymeWordA: 'cat', rhymeWordB: 'hat' },
  ],
};

const POEM_LINES = ['The moon smiled down on the bay', 'The waves were as soft as a song', 'The boats went to sleep for the day', 'And the night wind hummed along'];
const POEM = POEM_LINES.join('\n');
const fig = (text: string, type: string) => ({ text, type, startIndex: POEM.indexOf(text), endIndex: POEM.indexOf(text) + text.length });
const ANALYSIS: PoetryLabData = {
  title: 'Night Harbor', gradeLevel: '4', mode: 'analysis', poem: POEM, poemLines: POEM_LINES,
  correctMood: 'peaceful', moodOptions: ['peaceful', 'angry', 'scary', 'silly'],
  figurativeInstances: [fig('moon smiled', 'personification'), fig('as soft as a song', 'simile')],
  rhymeScheme: 'ABAB', rhymeSchemeOptions: ['ABAB', 'AABB', 'ABCB'],
};

const COMPOSITION: PoetryLabData = {
  title: 'Pond Haiku', gradeLevel: '3', mode: 'composition', templateType: 'haiku',
  compositionPrompt: 'Write a haiku about rain on a pond.', templateConstraints: { lineCount: 3, syllablesPerLine: [5, 7, 5] },
};

const BY_MODE: Record<string, PoetryLabData> = { rhyme_hunt: RHYME, analysis: ANALYSIS, composition: COMPOSITION };
/** The menus (the poem, the cards, the printed choices) name every option; any other fact must name no key. */
const MENUS = ['poem', 'poem2', 'wordCards', 'moodChoices', 'schemeChoices', 'constraints'];
const KEYS = /\b(log|dog|cat|hat|peaceful|ABAB|smiled|soft as)\b|rhymeWord|correctMood|isCorrect|figurativeInstances/;
const keyFacts = (demand: Record<string, unknown>) => JSON.stringify(Object.fromEntries(Object.entries(demand).filter(([k]) => !MENUS.includes(k))));

const mount = (mode: string, data: PoetryLabData) =>
  mountWorkspace({ primitiveId: 'poetry-lab', evalMode: mode, instanceId: 'poetry', data: data as unknown as Record<string, unknown> });

/** Do an item's harness work through the real controls. */
function answer(h: WorkspaceHarness, d: PoetryLabData, wrong = false) {
  const item = poetryItems(d).find(i => i.id === h.state().task!.itemId)!;
  const work = poetryHarnessWork(item, d, wrong);
  if (item.kind === 'rhyme_hunt') { work.picked.forEach(w => h.press(w)); return; }
  if (item.kind === 'mood') h.press(work.mood!);
  else if (item.kind === 'rhyme') h.press(work.scheme!);
  else if (item.kind === 'figurative') work.tapped.forEach(k => h.touch(k));
  else {
    const inputs = Array.from(h.view.container.querySelectorAll('input'));
    work.lines.forEach((text, i) => {
      const input = inputs.find(el => el.getAttribute('aria-label') === `Line ${i + 1}`)!;
      act(() => { fireEvent.change(input, { target: { value: text } }); });
    });
  }
  h.press(/^Check/);
}
const advance = (h: WorkspaceHarness) => { h.dispatch('advance'); h.confirmVisible(); };

it.each(Object.keys(BY_MODE))('%s binds every item with no scripted cue and no key in the packet', mode => {
  const d = BY_MODE[mode];
  const h = mount(mode, d);
  expect(h.state().owner).toBe('tutor');
  for (const item of poetryItems(d)) {
    expect(h.state().task!.itemId).toBe(item.id);
    expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
    expect(keyFacts(h.state().task!.demand)).not.toMatch(KEYS);
    answer(h, d);
    expect(h.state().task!.evidence.correctness).toBe('correct');
    advance(h);
  }
  expect(h.state().status).toBe('completed');
  expect(seam.legacyAI).not.toHaveBeenCalled();
  h.close();
});

it('rhyme_hunt cards are not drawn in line order, and a wrong pair stays marked until Try again', () => {
  // The generator lists the cards in line order with the pair always on lines 2 and 4.
  const orders = ['a', 'b', 'c', 'd', 'e', 'f'].map(s => rhymeCards({ ...RHYME.rounds![0], id: s }).map(c => c.word).join());
  expect(orders.some(o => o !== 'in,log,big,dog')).toBe(true);
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('rhyme_hunt', RHYME);
  h.press('in'); h.press('big');
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(JSON.stringify(h.state().task)).toContain('neither_of_pair');
  expect(String(h.state().task!.demand.learnerWork)).toBe('Tapped "in" and "big"');
  h.press('log');
  expect(String(h.state().task!.demand.learnerWork)).toBe('Tapped "in" and "big"');
  h.dispatch('retry');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'No card tapped yet' });
  answer(h, RHYME); advance(h);
  answer(h, RHYME); advance(h);
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [, , metrics, work] = seam.submit.mock.calls[0];
  expect(metrics).toMatchObject({ type: 'poetry-lab', mode: 'rhyme_hunt', roundsTotal: 2, roundsFirstTry: 1 });
  expect(work.teachingAttempts).toHaveLength(3);
  h.close();
});

it('figurative: every word is a button, a word in no phrase is wrong, and Try again clears the taps', () => {
  const d = { ...ANALYSIS, moodOptions: [], rhymeSchemeOptions: [] };
  const h = mount('analysis', d);
  expect(h.state().task!.itemId).toBe('figurative');
  const words = poemWords(d);
  expect(h.view.container.querySelectorAll('[data-pip-object^="poem-word-"]')).toHaveLength(words.length);
  answer(h, d, true);
  expect(JSON.stringify(h.state().task)).toContain('literal_picked');
  h.dispatch('retry');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'No word tapped yet' });
  h.touch(words.find(w => w.fig === 0)!.key); h.press(/^Check/);
  expect(JSON.stringify(h.state().task)).toContain('missed_some');
  h.dispatch('retry');
  answer(h, d);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.close();
});

it('composition checks the form, keeps the lines on Try again, and never prints a key', () => {
  const h = mount('composition', COMPOSITION);
  answer(h, COMPOSITION, true);
  expect(JSON.stringify(h.state().task)).toContain('syllables_off');
  h.dispatch('retry');
  expect(String(h.state().task!.demand.learnerWork)).toMatch(/^Line 1: "/);
  answer(h, COMPOSITION);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.close();
});

it('poetryMiss names each item\'s error', () => {
  const [round] = poetryItems(RHYME);
  const v = EMPTY_VIEW;
  expect(poetryMiss(round, RHYME, { ...v, picked: ['log', 'big'] })).toBe('one_of_pair');
  expect(poetryMiss(round, RHYME, { ...v, picked: ['big', 'dog'] })).toBe('one_of_pair');
  expect(poetryMiss(round, RHYME, { ...v, picked: ['log', 'dog'] })).toBeUndefined();
  expect(poetryMiss({ id: 'r', kind: 'rhyme_hunt', round: { ...round.round!, candidates: [{ word: 'dig', emoji: '⛏️' }, { word: 'log', emoji: '🪵' }, { word: 'dot', emoji: '⚫' }, { word: 'dog', emoji: '🐶' }] } },
    RHYME, { ...v, picked: ['dig', 'dot'] })).toBe('same_start');
  expect(poetryMiss({ id: 'mood', kind: 'mood' }, ANALYSIS, { ...v, mood: 'angry' })).toBe('other_mood');
  expect(poetryMiss({ id: 'rhyme', kind: 'rhyme' }, ANALYSIS, { ...v, scheme: 'AABB' })).toBe('aabb_abab');
  expect(poetryMiss({ id: 'rhyme', kind: 'rhyme' }, ANALYSIS, { ...v, scheme: 'ABCB' })).toBe('other_scheme');
  const compose = { id: 'compose', kind: 'compose' as const };
  expect(poetryMiss(compose, COMPOSITION, { ...v, lines: ['rain on the pond', '', 'frogs'] })).toBe('line_missing');
  expect(poetryMiss(compose, COMPOSITION, { ...v, lines: ['rain falls', 'frogs', 'pond'] })).toBe('line_too_short');
  expect(poetryMiss(compose, COMPOSITION, { ...v, lines: ['soft rain on the pond', 'soft rain on the pond', 'frogs leap'] })).toBe('line_repeated');
  const acrostic: PoetryLabData = { ...COMPOSITION, templateType: 'acrostic', templateConstraints: { lineCount: 3, acrosticWord: 'SUN' } };
  expect(poetryMiss(compose, acrostic, { ...v, lines: ['Sun is warm', 'Under the sky', 'Bright and hot'] })).toBe('wrong_first_letter');
  expect(poetryMiss(compose, acrostic, { ...v, lines: ['Sun is warm', 'Under the sky', 'Noon is hot'] })).toBeUndefined();
});
