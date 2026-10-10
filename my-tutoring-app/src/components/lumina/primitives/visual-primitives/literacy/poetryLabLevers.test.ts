/**
 * poetry-lab levers: leak rules per mode on every saved payload and the hand-built items, the practice builders (never
 * the session's item, same kind, solvable), and "this wrong answer, then this lever" as code.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { PoetryLabData } from './PoetryLab';
import {
  END_WORDS_LEVER, FEWER_CARDS_LEVER, FIGURE_MODELS_LEVER, FIRST_LETTERS_LEVER, MODEL_POEM_LEVER, MODE_MISSES, MOOD_FACES_LEVER,
  ONE_LINE_LEVER, PHRASE_COUNT_LEVER, RHYME_MODEL_LEVER, SYLLABLE_BEATS_LEVER, figureModelLeaks, figureModels, modelPoem,
  modelPoemLeaks, moodFacesLeak, poetryLeverFacts, poetryLevers, practiceFor, practiceLeaks, rhymeModel, rhymes,
} from './poetryLabLevers';
import { EMPTY_VIEW, poetryCorrect, poetryHarnessWork, poetryItems, poetryMiss, type PoetryItem } from './poetryLabWorkspace';
import { rimeOfWord } from './rhymeModels';

const DIR = join(__dirname, '../../../components/live-activity/runtime/testing/w1-payloads');
const PAYLOADS = readdirSync(DIR).filter(f => f.startsWith('poetry-lab.')).map(f =>
  JSON.parse(readFileSync(join(DIR, f), 'utf-8')) as { evalMode: string; data: PoetryLabData });
const ACROSTIC: PoetryLabData = { title: 'Sun', gradeLevel: '3', mode: 'composition', templateType: 'acrostic',
  compositionPrompt: 'Write an acrostic poem about the summer sun.', templateConstraints: { lineCount: 3, acrosticWord: 'SUN' } };
const FREE: PoetryLabData = { title: 'Rain', gradeLevel: '5', mode: 'composition', templateType: 'free-verse',
  compositionPrompt: 'Write a free verse poem about a storm.', templateConstraints: { lineCount: 4 } };
const ALL = [...PAYLOADS.map(p => [p.evalMode, p.data] as const), ['composition', ACROSTIC] as const, ['composition', FREE] as const];
const ITEMS = ALL.flatMap(([mode, d]) => poetryItems(d).map(item => [mode, item.id, item, d] as const));
const ALL_HELP = [RHYME_MODEL_LEVER, MOOD_FACES_LEVER, FIGURE_MODELS_LEVER, PHRASE_COUNT_LEVER, END_WORDS_LEVER, MODEL_POEM_LEVER,
  SYLLABLE_BEATS_LEVER, FIRST_LETTERS_LEVER];

/** What an item's key is, as words a lever must never say. */
function keyWords(item: PoetryItem, d: PoetryLabData): string[] {
  if (item.kind === 'rhyme_hunt') return [item.round!.rhymeWordA, item.round!.rhymeWordB];
  if (item.kind === 'mood') return [d.correctMood!];
  if (item.kind === 'rhyme') return [d.rhymeScheme!];
  if (item.kind === 'figurative') return (d.figurativeInstances ?? []).map(f => f.text);
  return [];
}
const said = (item: PoetryItem, d: PoetryLabData) => [
  ...poetryLevers(item, d, []).map(l => `${l.when} ${l.does}`), poetryLeverFacts(item, d, ALL_HELP),
].join(' ').toLowerCase();

describe('leak rules, per mode', () => {
  it('every mode has a saved payload', () => {
    expect(PAYLOADS.map(p => p.evalMode).sort()).toEqual(['analysis', 'composition', 'rhyme_hunt']);
  });
  it.each(ITEMS)('%s %s: no lever text or fact says the key', (_m, _id, item, d) => {
    for (const k of keyWords(item, d)) expect(said(item, d)).not.toMatch(new RegExp(`\\b${k.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`));
  });
  it.each(ITEMS.filter(([, , item]) => item.kind === 'rhyme_hunt'))('%s %s: the rhyme model uses no word or ending of any round', (_m, _id, _item, d) => {
    const m = rhymeModel(d)!;
    const used = (d.rounds ?? []).flatMap(r => r.candidates.map(c => c.word.toLowerCase()));
    for (const w of [...m.words, m.onsetFoil].map(x => x.word)) {
      expect(used).not.toContain(w);
      expect(used.map(rimeOfWord)).not.toContain(rimeOfWord(w));
    }
  });
  it.each(ITEMS.filter(([, , item]) => item.kind === 'figurative'))('%s %s: no figure model shares a word with the poem', (_m, _id, _item, d) => {
    expect(figureModels(d).length).toBeGreaterThanOrEqual(3);
    for (const m of figureModels(d)) expect(figureModelLeaks(d, m.example)).toBe(false);
  });
  it.each(ITEMS.filter(([, , item]) => item.kind === 'compose'))('%s %s: the model poem is the same form on another subject', (_m, _id, _item, d) => {
    const m = modelPoem(d)!;
    expect(modelPoemLeaks(d, m)).toBe(false);
    // Copying a model line does not pass.
    const lines = poetryHarnessWork({ id: 'compose', kind: 'compose' }, d, false).lines.slice();
    lines[0] = m.lines[0];
    expect(poetryMiss({ id: 'compose', kind: 'compose' }, d, { ...EMPTY_VIEW, lines, modelLines: m.lines })).toBe('line_repeated');
  });
  it('mood faces are offered only when every printed mood has one', () => {
    const d = PAYLOADS.find(p => p.evalMode === 'analysis')!.data;
    expect(moodFacesLeak(d)).toBe(false);
    expect(moodFacesLeak({ ...d, moodOptions: [...(d.moodOptions ?? []), 'bittersweet'] })).toBe(true);
    expect(poetryLevers({ id: 'mood', kind: 'mood' }, { ...d, moodOptions: ['bittersweet', 'happy'] }, []).map(l => l.id)).not.toContain(MOOD_FACES_LEVER);
  });
});

describe('practice builders', () => {
  it.each(ITEMS)('%s %s: a practice item of the same kind, not the session\'s, solvable', (_m, _id, item, d) => {
    const p = practiceFor(item, d)!;
    expect(p).toBeTruthy();
    expect(p.item.kind).toBe(item.kind);
    expect(p.item.id).not.toBe(item.id);
    if (item.kind === 'rhyme_hunt') {
      const r = p.item.round!;
      expect(r.candidates).toHaveLength(3);
      expect(rhymes(r.rhymeWordA, r.rhymeWordB)).toBe(true);
      const foil = r.candidates.find(c => c.word !== r.rhymeWordA && c.word !== r.rhymeWordB)!;
      expect(rhymes(foil.word, r.rhymeWordA)).toBe(false);
      const used = (d.rounds ?? []).flatMap(x => x.candidates.map(c => c.word.toLowerCase()));
      for (const c of r.candidates) expect(used).not.toContain(c.word);
    } else if (item.kind !== 'compose') {
      expect(practiceLeaks(p.data, d)).toBe(false);
    } else {
      expect(p.data.templateConstraints!.lineCount).toBe(1);
      expect(p.data.compositionPrompt).not.toBe(d.compositionPrompt);
    }
    // The harness' right work passes it and its wrong work names a miss.
    expect(poetryCorrect(p.item, p.data, poetryHarnessWork(p.item, p.data, false))).toBe(true);
    if (item.kind !== 'compose') expect(poetryMiss(p.item, p.data, poetryHarnessWork(p.item, p.data, true))).toBeTruthy();
    // A practice item carries no levers of its own (the component publishes none on it).
  });
});

describe('this wrong answer, then this lever', () => {
  it.each(ITEMS)('%s %s: every miss of the mode is answered by a lever on the item', (mode, _id, item, d) => {
    const levers = poetryLevers(item, d, []);
    const kinds: Record<string, readonly string[]> = { rhyme_hunt: MODE_MISSES.rhyme_hunt, mood: ['other_mood'],
      figurative: ['literal_picked', 'missed_some'], rhyme: ['aabb_abab', 'other_scheme'], compose: MODE_MISSES.composition };
    for (const miss of kinds[item.kind]) expect(levers.some(l => l.answers?.includes(miss)), `${mode} ${item.id} ${miss}`).toBe(true);
  });
  it.each([
    ['rhyme_hunt', 'same_start', RHYME_MODEL_LEVER], ['mood', 'other_mood', MOOD_FACES_LEVER],
    ['figurative', 'literal_picked', FIGURE_MODELS_LEVER], ['rhyme', 'aabb_abab', END_WORDS_LEVER],
    ['compose', 'syllables_off', MODEL_POEM_LEVER],
  ])('%s: %s pulls %s first', (kind, miss, lever) => {
    const [, , item, d] = ITEMS.find(([, , i]) => i.kind === kind)!;
    expect(nextLever(poetryLevers(item, d, []), miss)).toBe(lever);
  });
  it('once the help is pulled, the simplify comes next', () => {
    const [, , item, d] = ITEMS.find(([, , i]) => i.kind === 'rhyme_hunt')!;
    expect(nextLever(poetryLevers(item, d, [RHYME_MODEL_LEVER]), 'one_of_pair')).toBe(FEWER_CARDS_LEVER);
    expect(nextLever(poetryLevers({ id: 'compose', kind: 'compose' }, ACROSTIC, [MODEL_POEM_LEVER]), 'wrong_first_letter')).toBe(FIRST_LETTERS_LEVER);
    expect(nextLever(poetryLevers({ id: 'compose', kind: 'compose' }, ACROSTIC, [MODEL_POEM_LEVER, FIRST_LETTERS_LEVER]), 'line_missing')).toBe(ONE_LINE_LEVER);
  });
});
