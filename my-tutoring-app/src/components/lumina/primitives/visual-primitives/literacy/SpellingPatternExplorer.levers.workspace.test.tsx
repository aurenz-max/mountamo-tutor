// @vitest-environment jsdom
/**
 * spelling-pattern-explorer levers (`spellingPatternLevers.ts`) on the five classic modes, mounted the way a lesson
 * mounts it. The pattern words and the letter boxes change the screen and the scene fact in one commit and leave the
 * spelling to the learner; the shorter practice word is ungraded and gives the full word back blank; only the full
 * word's spelling is credited, with the levers recorded. Every saved payload's words are covered per item.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever, observerLever } from '../../../components/live-activity/runtime/observerLever';
import type { SpellingPatternExplorerData } from './SpellingPatternExplorer';
import { dictationItems, spellingHarnessAnswers, spellingMiss, SPELLING_MISSES } from './spellingPatternExplorerWorkspace';
import {
  BOXES_LEVER, PATTERN_WORDS_LEVER, SIMPLER_LEVER, letterBoxes, leverFacts, patternWordsLeak, practiceItem, practiceLeaks,
  practiceParent, shownPatternWords, spellingLevers, type SpellingSession,
} from './spellingPatternLevers';
import shortVowel from '../../../components/live-activity/runtime/testing/w1-payloads/spelling-pattern-explorer.short_vowel.json';
import longVowel from '../../../components/live-activity/runtime/testing/w1-payloads/spelling-pattern-explorer.long_vowel.json';
import rControlled from '../../../components/live-activity/runtime/testing/w1-payloads/spelling-pattern-explorer.r_controlled.json';
import silentLetter from '../../../components/live-activity/runtime/testing/w1-payloads/spelling-pattern-explorer.silent_letter.json';
import morphological from '../../../components/live-activity/runtime/testing/w1-payloads/spelling-pattern-explorer.morphological.json';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const dataOf = (p: unknown) => (p as { data: SpellingPatternExplorerData }).data;
const PAYLOADS: [string, SpellingPatternExplorerData][] = [
  ['short_vowel', dataOf(shortVowel)], ['long_vowel', dataOf(longVowel)], ['r_controlled', dataOf(rControlled)],
  ['silent_letter', dataOf(silentLetter)], ['morphological', dataOf(morphological)],
];
const sessionOf = (d: SpellingPatternExplorerData): SpellingSession => ({ patternWords: d.patternWords, highlightPattern: d.highlightPattern,
  items: dictationItems(d.dictationWords, d.dictationHints), supportTier: d.supportTier });
const lesson = (d: Partial<SpellingPatternExplorerData>): SpellingPatternExplorerData => ({
  title: 'Long a', gradeLevel: '2', patternType: 'long-vowel', patternWords: ['rain', 'train', 'pain', 'tail', 'brain'],
  highlightPattern: 'ai', ruleTemplate: 'ai says __', correctRule: 'a', dictationWords: ['brain', 'chain', 'sail'], ...d });

describe('the lever rules (pure)', () => {
  it.each(PAYLOADS)('%s: every word has a lever for every miss; the shown words and practice words are never dictated', (_m, d) => {
    const s = sessionOf(d);
    expect(patternWordsLeak(shownPatternWords(s), s)).toBe(false);
    for (const item of s.items) {
      const levers = spellingLevers(item, s, []);
      for (const miss of SPELLING_MISSES) expect(nextLever(levers, miss), `${item.word} ${miss}`).toBeTruthy();
      const p = practiceItem(item, s);
      if (p) {
        expect(p.id).toBe(`${item.id}~simpler`);
        expect(p.word.length).toBeLessThan(item.word.length);
        expect(practiceLeaks(p, s)).toBe(false);
        expect(practiceParent(p.id, s.items)).toBe(item);
      }
      expect(levers.some(l => l.id === SIMPLER_LEVER)).toBe(!!p);
    }
  });

  it('a pattern word the lesson also dictates is never shown again (morphological: smiling)', () => {
    const s = sessionOf(dataOf(morphological));
    expect(s.patternWords).toContain('smiling');
    expect(shownPatternWords(s)).not.toContain('smiling');
  });

  it('the practice word keeps the pattern: the same letters when the pattern names them, else the same edge', () => {
    const r = sessionOf(dataOf(rControlled));
    expect(practiceItem(r.items.find(i => i.word === 'sharp')!, r)!.word).toMatch(/ar/);
    expect(practiceItem(r.items.find(i => i.word === 'north')!, r)!.word).toMatch(/or/);
    const sl = sessionOf(dataOf(silentLetter));
    expect(practiceItem(sl.items.find(i => i.word === 'knock')!, sl)!.word).toMatch(/^kn/);
    expect(practiceItem(sl.items.find(i => i.word === 'thumb')!, sl)!.word).toMatch(/mb$/);
    expect(practiceItem(sl.items.find(i => i.word === 'wrist')!, sl)!.word).toMatch(/^wr/);
  });

  it('a word already the shortest the lesson has gets no simpler word (short vowel CVC)', () => {
    const s = sessionOf(dataOf(shortVowel));
    for (const item of s.items) expect(practiceItem(item, s)).toBeNull();
  });

  it('the boxes hold only the learner\'s typing; the facts never spell the word', () => {
    const item = { id: 'w1', word: 'brain' };
    expect(letterBoxes(item, '')).toEqual({ boxes: ['', '', '', '', ''], extra: '' });
    expect(letterBoxes(item, 'bran')).toEqual({ boxes: ['b', 'r', 'a', 'n', ''], extra: '' });
    expect(letterBoxes(item, 'braine')).toEqual({ boxes: ['b', 'r', 'a', 'i', 'n'], extra: 'e' });
    for (const [, d] of PAYLOADS) {
      const s = sessionOf(d);
      for (const it of s.items) {
        const fact = leverFacts(it, s, [PATTERN_WORDS_LEVER, BOXES_LEVER])!;
        expect(fact.toLowerCase().split(/[^a-z]+/)).not.toContain(it.word.toLowerCase());
      }
    }
  });

  it.each([
    ['pattern_missing', [], PATTERN_WORDS_LEVER], ['other_letters', [], BOXES_LEVER], ['misspelled', [], PATTERN_WORDS_LEVER],
    ['pattern_missing', [PATTERN_WORDS_LEVER], BOXES_LEVER], ['other_letters', [BOXES_LEVER], SIMPLER_LEVER],
    ['pattern_missing', [PATTERN_WORDS_LEVER, BOXES_LEVER], SIMPLER_LEVER],
  ])('after %s with %j pulled, the next lever is %s', (miss, pulled, want) => {
    const s = sessionOf(lesson({}));
    expect(nextLever(spellingLevers(s.items[0], s, pulled as string[]), miss)).toBe(want);
  });

  it('the misses the check names are the ones the levers answer', () => {
    const item = { id: 'w1', word: 'brain' };
    expect(spellingMiss(item, 'brane', 'ai')).toBe('pattern_missing');
    expect(spellingMiss(item, 'bain', 'ai')).toBe('other_letters');
    expect(spellingMiss({ id: 'w1', word: 'knock' }, 'nock', 'silent letter')).toBe('misspelled');
  });
});

// ── mounted ───────────────────────────────────────────────────────────────

const q = (h: WorkspaceHarness, sel: string) => h.view.container.querySelectorAll(sel);
const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers ?? [];
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const type = (h: WorkspaceHarness, label: string, text: string) =>
  act(() => { fireEvent.change(h.view.getByLabelText(label), { target: { value: text } }); });
const spell = (h: WorkspaceHarness, text: string) => { type(h, 'Your spelling', text); h.press('Check spelling'); };
const toApply = (h: WorkspaceHarness) => {
  h.press(/I see the pattern/);
  type(h, 'Your spelling rule', 'The words share ai.');
  h.press(/Next: Apply the Rule/);
};
const mount = (d: SpellingPatternExplorerData, mode = 'long_vowel') =>
  mountWorkspace({ primitiveId: 'spelling-pattern-explorer', evalMode: mode, data: d as never });

it('no levers before spelling; a wrong pattern, then the pattern words: drawn in the same commit, recorded on the next try', () => {
  const h = mount(lesson({}));
  expect(levers(h)).toEqual([]);
  toApply(h);
  expect(levers(h).map(l => [l.id, l.pulled])).toEqual([[PATTERN_WORDS_LEVER, false], [BOXES_LEVER, false], [SIMPLER_LEVER, false]]);
  expect(q(h, '[data-lever]')).toHaveLength(0);
  spell(h, 'brane');
  expect(last(h)).toMatchObject({ itemId: 'w1', correct: false, miss: 'pattern_missing' });
  expect(observerLever(h.state(), true)).toBe(PATTERN_WORDS_LEVER);
  const receipt = h.dispatch('pull_lever', { lever: PATTERN_WORDS_LEVER });
  expect(receipt.status).toBe('committed');
  // brain is dictated, so it is not among the shown words.
  expect(Array.from(q(h, '[data-pattern-word]')).map(e => e.getAttribute('data-pattern-word'))).toEqual(['rain', 'train', 'pain', 'tail']);
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/rain, train, pain, tail/);
  expect(String(receipt.state.task!.demand.onScreen)).not.toMatch(/brain/);
  // A refused pull changes nothing on screen, in the levers or in the attempts.
  const before = { levers: JSON.stringify(levers(h)), attempts: h.state().task!.workspace!.attempts.length,
    html: h.view.container.innerHTML };
  expect(h.dispatch('pull_lever', { lever: PATTERN_WORDS_LEVER }).status).toBe('blocked');
  expect({ levers: JSON.stringify(levers(h)), attempts: h.state().task!.workspace!.attempts.length,
    html: h.view.container.innerHTML }).toEqual(before);
  h.dispatch('retry');
  spell(h, 'brain');
  expect(last(h)).toMatchObject({ itemId: 'w1', correct: true, assisted: true, levers: [PATTERN_WORDS_LEVER] });
  h.close();
});

it('the letter boxes fill with the learner\'s own typing and give no letter', () => {
  const h = mount(lesson({}));
  toApply(h);
  spell(h, 'bain');
  expect(last(h)).toMatchObject({ miss: 'other_letters' });
  expect(observerLever(h.state(), true)).toBe(BOXES_LEVER);
  const receipt = h.dispatch('pull_lever', { lever: BOXES_LEVER });
  expect(receipt.status).toBe('committed');
  expect(Array.from(q(h, '[data-letter-box]')).map(e => e.textContent)).toEqual(['b', 'a', 'i', 'n', '']);
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/5 letter boxes/);
  h.dispatch('retry');
  type(h, 'Your spelling', 'br');
  expect(Array.from(q(h, '[data-letter-box]')).map(e => e.textContent)).toEqual(['b', 'r', '', '', '']);
  h.close();
});

it('the shorter practice word is ungraded and keeps its typing on Try again; the full word comes back blank and is credited', () => {
  const h = mount(lesson({}));
  toApply(h);
  spell(h, 'brane');
  h.dispatch('pull_lever', { lever: PATTERN_WORDS_LEVER });
  h.dispatch('pull_lever', { lever: BOXES_LEVER });
  const receipt = h.dispatch('pull_lever', { lever: SIMPLER_LEVER });
  expect(receipt.status).toBe('committed');
  expect(h.state().task).toMatchObject({ itemId: 'w1~simpler' });
  expect(h.state().task!.task).toContain('"rain"');
  expect(demand(h)).toMatchObject({ lettersTyped: 0 });
  expect(levers(h)).toEqual([]);
  expect(q(h, '[data-lever]')).toHaveLength(0);
  spell(h, 'rane');
  expect(last(h)).toMatchObject({ itemId: 'w1~simpler', correct: false, miss: 'pattern_missing' });
  h.dispatch('retry');
  expect((h.view.getByLabelText('Your spelling') as HTMLInputElement).value).toBe('rane');
  spell(h, 'rain');
  expect(last(h)).toMatchObject({ itemId: 'w1~simpler', correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'w1' });
  expect((h.view.getByLabelText('Your spelling') as HTMLInputElement).value).toBe('');
  expect(q(h, '[data-lever="pattern-words"]')).toHaveLength(1);
  spell(h, 'brain');
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['w1', false, false], ['w1~simpler', false, true], ['w1~simpler', true, true], ['w1', true, false]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: [PATTERN_WORDS_LEVER, BOXES_LEVER, SIMPLER_LEVER] });
  h.close();
});

it('easy starts with the pattern words shown, and that is not a pull', () => {
  const h = mount(lesson({ supportTier: 'easy' }));
  toApply(h);
  expect(levers(h).find(l => l.id === PATTERN_WORDS_LEVER)!.pulled).toBe(true);
  expect(q(h, '[data-lever="pattern-words"]')).toHaveLength(1);
  spell(h, 'brain');
  expect(last(h)).toMatchObject({ correct: true });
  expect(last(h)!.levers).toBeUndefined();
  h.close();
});

it.each(PAYLOADS)('%s payload: the harness wrong spelling names a miss with a lever on every word', (mode, d) => {
  const s = sessionOf(d);
  for (const item of s.items) {
    const miss = spellingMiss(item, spellingHarnessAnswers(item, d.highlightPattern).plainWrong, d.highlightPattern);
    expect(miss, `${mode} ${item.word}`).toBeTruthy();
    expect(nextLever(spellingLevers(item, s, []), miss)).toBeTruthy();
  }
});
