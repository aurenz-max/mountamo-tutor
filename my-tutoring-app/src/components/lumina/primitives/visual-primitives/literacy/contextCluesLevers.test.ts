/**
 * context-clues-detective levers: which lever answers which miss, and the leak rules, per mode, in code.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { ContextClueChallenge } from './ContextCluesDetective';
import { CLUE_TYPE_LABEL, CONTEXT_CLUE_MISSES_BY_MODE, clueSteps, type ClueStep, type ContextClueMiss } from './contextCluesWorkspace';
import {
  CROSS_OUT_LEVER, SENTENCE_LIST_LEVER, SIGNAL_WORDS_LEVER, STRATEGY_BY_TYPE, STRATEGY_LEVER, TRY_IN_PLACE_LEVER,
  TYPE_DESCRIPTIONS_LEVER, clueLeverFacts, clueLevers, clueSignalWords, crossOutLeaks, ruledOutBy, signalWordsIn,
  tryInPlace, type ClueLeverContext,
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
const BARE: ClueLeverContext = { listShown: false, descriptionsShown: false, strategyShown: false, ruledOut: [] };
// A word of another type beside the item, so the session mixes types and builds every step (classify included).
const OTHER = (c: ContextClueChallenge) => ({ ...c, id: 'z', clueType: c.clueType === 'synonym' ? 'antonym' as const : 'synonym' as const });
const allSteps = (c: ContextClueChallenge) => clueSteps([c, OTHER(c)]).filter(s => s.challenge.id === c.id);
const stepOf = (c: ContextClueChallenge, phase: ClueStep['phase']) => allSteps(c).find(s => s.phase === phase)!;
const ids = (step: ClueStep, ctx = BARE, pulled: string[] = []) => clueLevers(step, pulled, ctx).map(l => l.id);
const KEY_WORDS = Object.values(CLUE_TYPE_LABEL);

describe.each(Object.keys(ITEMS))('%s', mode => {
  const c = ITEMS[mode];
  it('every step declares help levers, and every catalog miss of the step is answered by one', () => {
    const ruled = ruledOutBy(c, [c.passage.sentences.find(s => !c.clueSentenceIds.includes(s.id) && s.id !== c.targetWordSentenceId)!.id], 'no_clue');
    const all = allSteps(c).flatMap(step => clueLevers(step, [], { ...BARE, ruledOut: step.phase === 'find' ? ruled : [] }));
    expect(all.every(l => l.kind === 'help' && l.carrier === 'shown')).toBe(true);
    const answered = new Set(all.flatMap(l => l.answers ?? []));
    for (const miss of CONTEXT_CLUE_MISSES_BY_MODE[mode]) expect(answered.has(miss), miss).toBe(true);
  });
  it('nextLever: the miss picks a lever on its own step', () => {
    const find = stepOf(c, 'find'), classify = stepOf(c, 'classify'), define = stepOf(c, 'define');
    expect(nextLever(clueLevers(find, [], BARE), 'no_clue')).toBe(SENTENCE_LIST_LEVER);
    expect(nextLever(clueLevers(find, [SENTENCE_LIST_LEVER], { ...BARE, ruledOut: ['x'] }), 'no_clue')).toBe(CROSS_OUT_LEVER);
    expect(nextLever(clueLevers(classify, [], BARE), mode === 'inference' ? 'stated_for_inference' : 'other_type')).toBe(TYPE_DESCRIPTIONS_LEVER);
    expect(nextLever(clueLevers(define, [], BARE), 'other_meaning')).toBe(STRATEGY_LEVER);
    expect(nextLever(clueLevers(define, [STRATEGY_LEVER], BARE), 'other_meaning')).toBe(TRY_IN_PLACE_LEVER);
  });
  it('leak rules: no lever fact names a clue type before classify is credited, or the meaning', () => {
    for (const step of allSteps(c)) {
      const pulled = clueLevers(step, [], { ...BARE, ruledOut: ['x'] }).map(l => l.id);
      const facts = clueLeverFacts(step, pulled, { ...BARE, ruledOut: [], meaning: '' })
        + clueLevers(step, pulled, BARE).map(l => l.does).join(' ');
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
  // No ruled-out sentence: no cross_out lever.
  expect(ids(stepOf(d, 'find'))).toEqual([SENTENCE_LIST_LEVER]);
});

it('a tier starting position reads as pulled, so it is never offered again', () => {
  const ctx = { listShown: true, descriptionsShown: true, strategyShown: true, ruledOut: [] };
  for (const step of allSteps(ITEMS.synonym_antonym))
    expect(clueLevers(step, [], ctx).filter(l => [SENTENCE_LIST_LEVER, TYPE_DESCRIPTIONS_LEVER, STRATEGY_LEVER].includes(l.id))
      .every(l => l.pulled)).toBe(true);
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
  expect(clueLeverFacts(stepOf(s, 'define'), [TRY_IN_PLACE_LEVER], { ...BARE, meaning: '' })).not.toContain(s.correctMeaning);
  // A sentence without the word as written: no lever.
  const off = { ...s, targetWord: 'timidly' };
  expect(tryInPlace(off, '')).toBeNull();
  expect(ids(stepOf(off, 'define'))).toEqual([STRATEGY_LEVER]);
});

it('the strategy names how to read the clue, never a meaning', () => {
  for (const c of Object.values(ITEMS)) expect(STRATEGY_BY_TYPE[c.clueType]).not.toContain(c.correctMeaning);
});

it('every saved payload word: every miss of every step is answered by a lever on that step', () => {
  const dir = join(process.cwd(), 'src/components/lumina/components/live-activity/runtime/testing/w1-payloads');
  const files = readdirSync(dir).filter(f => f.startsWith('context-clues-detective.'));
  expect(files.length).toBeGreaterThanOrEqual(4);
  const FIND: ContextClueMiss[] = ['no_clue', 'extra_sentence', 'target_sentence_only'];
  for (const f of files) {
    const { evalMode, data } = JSON.parse(readFileSync(join(dir, f), 'utf-8'));
    for (const step of clueSteps(data.challenges)) {
      const levers = clueLevers(step, [], { ...BARE, ruledOut: ['x'] });
      const answered = new Set(levers.flatMap(l => l.answers ?? []));
      const misses = (CONTEXT_CLUE_MISSES_BY_MODE[evalMode] as ContextClueMiss[]).filter(m =>
        step.phase === 'find' ? FIND.includes(m) : step.phase === 'define' ? m === 'other_meaning' : !FIND.includes(m) && m !== 'other_meaning');
      for (const m of misses) expect(answered.has(m), `${f} ${step.id} ${m}`).toBe(true);
    }
  }
});
