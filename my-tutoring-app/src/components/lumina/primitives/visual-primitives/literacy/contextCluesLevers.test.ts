/**
 * context-clues-detective levers (`CLUE_LEVERS`): which lever answers which miss, and the leak rules, per mode, in code.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { ContextClueChallenge } from './ContextCluesDetective';
import { CLUE_TYPE_LABEL, CONTEXT_CLUE_MISSES_BY_MODE, clueSteps, type ClueStep, type ContextClueMiss } from './contextCluesWorkspace';
import {
  CLUE_LEVERS, CROSS_OUT_LEVER, SENTENCE_LIST_LEVER, SIGNAL_WORDS_LEVER, STRATEGY_BY_TYPE, STRATEGY_LEVER, TRY_IN_PLACE_LEVER,
  TYPE_DESCRIPTIONS_LEVER, clueSignalWords, crossOutLeaks, ruledOutBy, signalWordsIn, tierShown, tryInPlace,
  type ClueLeverContext,
} from './contextCluesLevers';

const word = (id: string, clueType: ContextClueChallenge['clueType'], targetWord: string, texts: string[], target: number,
  clues: number[], correctMeaning: string): ContextClueChallenge => ({
  id, clueType, targetWord, correctMeaning, dictionaryDefinition: correctMeaning,
  passage: { sentences: texts.map((text, i) => ({ id: `${id}_s${i + 1}`, text, isClue: clues.includes(i + 1) })) },
  targetWordSentenceId: `${id}_s${target}`, clueSentenceIds: clues.map(n => `${id}_s${n}`),
  meaningOptions: [correctMeaning, 'Very loud', 'Sleepy', 'Fast'],
});
const ITEMS: Record<string, ContextClueChallenge> = {
  definition: word('d', 'definition', 'nocturnal', ['Owls hunt at a strange time.', 'They are nocturnal animals.',
    'Nocturnal means awake at night.'], 2, [3], 'Up at night, asleep by day'),
  synonym_antonym: word('s', 'antonym', 'timid', ['The puppy was timid.', 'Unlike his bold sister, he hid.', 'He liked socks.'], 1, [2], 'Shy'),
  example: word('e', 'example', 'reptiles', ['We visited the zoo.', 'We saw reptiles, such as snakes and lizards.', 'Then we ate.'], 2, [2], 'Scaly animals'),
  inference: word('i', 'inference', 'parched', ['We hiked for hours in the sun.', 'Our bottles were empty.',
    'My throat felt parched.', 'I gulped the water.'], 3, [1, 4], 'Very dry'),
};
const BARE: ClueLeverContext = { ruledOut: [], meaning: '' };
// A word of another type beside the item, so the session mixes types and builds every step (classify included).
const OTHER = (c: ContextClueChallenge) => ({ ...c, id: 'z', clueType: c.clueType === 'synonym' ? 'antonym' as const : 'synonym' as const });
const allSteps = (c: ContextClueChallenge) => clueSteps([c, OTHER(c)]).filter(s => s.challenge.id === c.id);
const stepOf = (c: ContextClueChallenge, phase: ClueStep['phase']) => allSteps(c).find(s => s.phase === phase)!;
const declare = (step: ClueStep, ctx = BARE, pulled: string[] = []) => CLUE_LEVERS.declare(step, ctx, pulled);
const ids = (step: ClueStep, ctx = BARE, pulled: string[] = []) => declare(step, ctx, pulled).map(l => l.id);
const KEY_WORDS = Object.values(CLUE_TYPE_LABEL);

describe.each(Object.keys(ITEMS))('%s', mode => {
  const c = ITEMS[mode];
  it('every step declares help levers, and every catalog miss of the mode is answered by one', () => {
    const ruled = ruledOutBy(c, [c.passage.sentences.find(s => !c.clueSentenceIds.includes(s.id) && s.id !== c.targetWordSentenceId)!.id], 'no_clue');
    const all = allSteps(c).flatMap(step => declare(step, { ...BARE, ruledOut: step.phase === 'find' ? ruled : [] }));
    expect(all.every(l => l.kind === 'help')).toBe(true);
    const answered = new Set(all.flatMap(l => l.answers ?? []));
    for (const miss of CONTEXT_CLUE_MISSES_BY_MODE[mode]) expect(answered.has(miss), miss).toBe(true);
  });
  it('nextLever: the miss picks a lever on its own step', () => {
    const find = stepOf(c, 'find'), classify = stepOf(c, 'classify'), define = stepOf(c, 'define');
    const outside = c.passage.sentences.find(s => !c.clueSentenceIds.includes(s.id))!.id;
    expect(nextLever(declare(find), 'no_clue')).toBe(SENTENCE_LIST_LEVER);
    expect(nextLever(declare(find, { ...BARE, ruledOut: [outside] }, [SENTENCE_LIST_LEVER]), 'no_clue')).toBe(CROSS_OUT_LEVER);
    expect(nextLever(declare(classify), 'other_type')).toBe(TYPE_DESCRIPTIONS_LEVER);
    expect(nextLever(declare(define), 'other_meaning')).toBe(STRATEGY_LEVER);
    expect(nextLever(declare(define, BARE, [STRATEGY_LEVER]), 'other_meaning')).toBe(TRY_IN_PLACE_LEVER);
  });
  it('leak rules: no lever fact names a clue type before classify is credited, or the meaning', () => {
    for (const step of allSteps(c)) {
      const outside = c.passage.sentences.filter(s => !c.clueSentenceIds.includes(s.id)).map(s => s.id);
      const ctx = { ...BARE, ruledOut: outside };
      const pulled = declare(step, ctx).map(l => l.id);
      const facts = CLUE_LEVERS.onScreen(step, ctx, pulled) + declare(step, ctx, pulled).map(l => l.does).join(' ');
      expect(facts).not.toContain(c.correctMeaning);
      if (step.phase !== 'define') for (const label of KEY_WORDS) expect(facts, label).not.toMatch(new RegExp(`\\b${label}\\b`, 'i'));
    }
  });
});

it('cross_out greys only sentences a check showed hold no clue, and never a clue sentence', () => {
  const d = ITEMS.definition;
  expect(ruledOutBy(d, ['d_s1'], 'no_clue')).toEqual(['d_s1']);
  expect(ruledOutBy(d, ['d_s1', 'd_s3'], 'extra_sentence')).toEqual([]);
  expect(ruledOutBy(d, ['d_s2'], 'target_sentence_only')).toEqual(['d_s2']);
  // The word's own sentence that is itself a clue is never ruled out.
  const both = { ...d, clueSentenceIds: ['d_s2', 'd_s3'] };
  expect(ruledOutBy(both, ['d_s2'], 'target_sentence_only')).toEqual([]);
  expect(crossOutLeaks(d, ['d_s3'])).toBe(true);
  expect(crossOutLeaks(d, ['d_s1'])).toBe(false);
  // No ruled-out sentence, or one that is a clue: no cross_out lever.
  expect(ids(stepOf(d, 'find'))).toEqual([SENTENCE_LIST_LEVER]);
  expect(ids(stepOf(d, 'find'), { ...BARE, ruledOut: ['d_s3'] })).toEqual([SENTENCE_LIST_LEVER]);
  expect(ids(stepOf(d, 'find'), { ...BARE, ruledOut: ['d_s1'] })).toEqual([SENTENCE_LIST_LEVER, CROSS_OUT_LEVER]);
});

it('a tier starting position reads as pulled, so it is never offered again, and its fact is published', () => {
  const tiered = { ...ITEMS.synonym_antonym, showClueHints: true, showClueTypeDescriptions: true, strategyHint: 'Strategy: flip it.' };
  for (const step of allSteps(tiered)) {
    const shown = tierShown(step);
    expect(shown).toHaveLength(1);
    expect(declare(step, BARE, shown).filter(l => shown.includes(l.id)).every(l => l.pulled)).toBe(true);
  }
  expect(CLUE_LEVERS.onScreen(stepOf(tiered, 'define'), BARE, tierShown(stepOf(tiered, 'define'))))
    .toBe('Printed under the question: "Strategy: flip it."');
  // No tier flags: the descriptions still start on (the no-tier default), nothing else.
  expect(allSteps(ITEMS.synonym_antonym).flatMap(tierShown)).toEqual([TYPE_DESCRIPTIONS_LEVER]);
});

it('signal_words underlines only signal words in the clue sentences, never a type name; none, no lever', () => {
  expect(clueSignalWords(ITEMS.synonym_antonym)).toEqual(['unlike']);
  expect(clueSignalWords(ITEMS.example)).toEqual(['such as']);
  expect(clueSignalWords(ITEMS.definition)).toEqual(['means']);
  expect(signalWordsIn('A synonym, for example, is like a twin.')).toEqual(['for example', 'like']);
  expect(ids(stepOf(ITEMS.inference, 'classify'))).toEqual([TYPE_DESCRIPTIONS_LEVER]);
  expect(ids(stepOf(ITEMS.synonym_antonym, 'classify'))).toEqual([TYPE_DESCRIPTIONS_LEVER, SIGNAL_WORDS_LEVER]);
});

it('try_in_place fills the word\'s place with the learner\'s own pick only', () => {
  const s = ITEMS.synonym_antonym;
  expect(tryInPlace(s, '')).toBe('The puppy was ___.');
  expect(tryInPlace(s, 'Very loud')).toBe('The puppy was [Very loud].');
  expect(CLUE_LEVERS.onScreen(stepOf(s, 'define'), BARE, [TRY_IN_PLACE_LEVER])).not.toContain(s.correctMeaning);
  expect(CLUE_LEVERS.onScreen(stepOf(s, 'define'), { ...BARE, meaning: 'Very loud' }, [TRY_IN_PLACE_LEVER]))
    .toContain('"The puppy was [Very loud]."');
  // A sentence without the word as written: no lever.
  const off = { ...s, targetWord: 'timidly' };
  expect(tryInPlace(off, '')).toBeNull();
  expect(ids(stepOf(off, 'define'))).toEqual([STRATEGY_LEVER]);
});

it('the strategy names how to read the clue, never a meaning; a strategy that would name it is not offered', () => {
  for (const c of Object.values(ITEMS)) expect(STRATEGY_BY_TYPE[c.clueType]).not.toContain(c.correctMeaning);
  const leaky = { ...ITEMS.synonym_antonym, strategyHint: 'Strategy: it means Shy.' };
  expect(ids(stepOf(leaky, 'define'))).not.toContain(STRATEGY_LEVER);
});

it('every saved payload word: every miss of every step is answered by a lever on that step', () => {
  const dir = join(process.cwd(), 'src/components/lumina/components/live-activity/runtime/testing/w1-payloads');
  const files = readdirSync(dir).filter(f => f.startsWith('context-clues-detective.'));
  expect(files.length).toBeGreaterThanOrEqual(4);
  const FIND: ContextClueMiss[] = ['no_clue', 'extra_sentence', 'target_sentence_only'];
  for (const f of files) {
    const { evalMode, data } = JSON.parse(readFileSync(join(dir, f), 'utf-8'));
    for (const step of clueSteps(data.challenges)) {
      const outside = step.challenge.passage.sentences.filter((s: { id: string }) => !step.challenge.clueSentenceIds.includes(s.id)).map((s: { id: string }) => s.id);
      const levers = declare(step, { ...BARE, ruledOut: outside.slice(0, 1) });
      const answered = new Set(levers.flatMap(l => l.answers ?? []));
      const misses = (CONTEXT_CLUE_MISSES_BY_MODE[evalMode] as ContextClueMiss[]).filter(m =>
        step.phase === 'find' ? FIND.includes(m) : step.phase === 'define' ? m === 'other_meaning' : !FIND.includes(m) && m !== 'other_meaning');
      for (const m of misses) expect(answered.has(m), `${f} ${step.id} ${m}`).toBe(true);
    }
  }
});
