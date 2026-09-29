/**
 * word-workout's spoken-mode levers (`/add-support-tiers`, handoff 22 L3): every help lever is a visual mark on the
 * print, every practice item is built in code and prints no session word (R3), and it keeps the item's act (R2).
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { LITERACY_CATALOG } from '../../../service/manifest/catalog/literacy';
import { chunkBreak } from '../../../ui/printSupport';
import { PRACTICE_LINES, printedSet, wordsOf } from './decodablePracticeLines';
import { EARLY_EXTENDED_WORDS } from './wordWorkoutEarlyDecoding';
import { itemsFromChallenges, type WordWorkoutItem } from './wordWorkoutScript';
import {
  WORD_WORKOUT_SPOKEN_MISSES, easierEnding, lessonVowels, printedBySession, questionIcon, shortChain, spokenPracticeLeak,
  threeWordSentence, wordWorkoutEvalMode, wordWorkoutLevers,
} from './wordWorkoutLevers';

const ids = (item: WordWorkoutItem, items: readonly WordWorkoutItem[], pulled: string[] = []) =>
  wordWorkoutLevers(item, pulled, items, lessonVowels([], items)).map(l => l.id);

const CHAIN = itemsFromChallenges([{ id: 'c', mode: 'word-chains', chain: ['cat', 'hat', 'hot'], chainCueLevel: 'none' }]);
const SENTENCE = itemsFromChallenges([{ id: 's', mode: 'sentence-reading', sentence: 'The cat sat on the mat.', cvcWords: ['cat', 'sat', 'mat'],
  comprehensionQuestion: 'Where did the cat sit?', comprehensionAnswer: 'mat' }]);
const REAL = itemsFromChallenges([{ id: 'r', mode: 'real-vs-nonsense', realWord: 'pig', nonsenseWord: 'zog' }]);
const inflected = (word: string) => itemsFromChallenges([{ id: word, mode: 'inflected-word', targetWord: word }]);

describe('chunk divider', () => {
  it.each(EARLY_EXTENDED_WORDS.map(e => [e.word, e.decodingParts] as const))('%s: after its first chunk, inside the word', (word, parts) => {
    expect(chunkBreak(word, parts)).toBe(parts[0].length);
  });
});

describe('practice items keep the act and print no session word (R3)', () => {
  it('short chain: two new words, only the first letter changes, in the lesson vowels, no session rime', () => {
    for (const vowels of [['a'], ['o'], ['a', 'o'], ['a', 'e', 'i', 'o', 'u']]) {
      const practice = shortChain(CHAIN[1], CHAIN, vowels)!;
      expect(practice.kind).toBe('chain_word');
      expect(practice.chain).toHaveLength(2);
      const [a, b] = practice.chain!;
      expect(a.slice(1)).toBe(b.slice(1));
      expect(a[0]).not.toBe(b[0]);
      expect([a, b].every(w => vowels.includes(w[1]))).toBe(true);
      expect(['at', 'ot']).not.toContain(a.slice(1));
      expect(spokenPracticeLeak(practice, CHAIN)).toBe(false);
    }
  });

  it('easier ending: an -ing or -ed word practises a new -s word; an -s word has no easier one', () => {
    for (const e of EARLY_EXTENDED_WORDS.filter(x => x.mode === 'inflected-word')) {
      const items = inflected(e.word);
      const practice = easierEnding(items[0], items, ['a', 'e', 'i', 'o', 'u']);
      if (e.kind === 'ending-s') { expect(practice).toBeNull(); continue; }
      expect(practice!.targetWord).toMatch(/s$/);
      expect(EARLY_EXTENDED_WORDS.find(x => x.word === practice!.targetWord)!.kind).toBe('ending-s');
      expect(spokenPracticeLeak(practice!, items)).toBe(false);
    }
  });

  it('three-word sentence: a pool line sharing no word with the session; a three-word sentence has no shorter one', () => {
    const practice = threeWordSentence(SENTENCE[0], SENTENCE)!;
    expect(wordsOf(practice.sentence)).toHaveLength(3);
    expect(spokenPracticeLeak(practice, SENTENCE)).toBe(false);
    const short = itemsFromChallenges([{ id: 't', mode: 'sentence-reading', sentence: 'Sam can hop.' }]);
    expect(threeWordSentence(short[0], short)).toBeNull();
  });

  it('every pool line: a session that prints it still gets another line', () => {
    for (const line of PRACTICE_LINES) {
      const items = itemsFromChallenges([{ id: 's', mode: 'sentence-reading', sentence: `${line.text.replace(/\.$/, '')} and we sat.` }]);
      const practice = threeWordSentence(items[0], items);
      expect(practice, line.text).toBeTruthy();
      expect(wordsOf(practice!.sentence).some(w => printedSet(items[0].sentence).has(w))).toBe(false);
    }
  });

  it('the printed set covers sentences, pairs and near words', () => {
    const printed = printedBySession([...SENTENCE, ...REAL]);
    for (const w of ['the', 'cat', 'mat', 'pig', 'zog']) expect(printed.has(w)).toBe(true);
  });
});

describe('levers per item kind, and the miss each answers', () => {
  it('real or silly: dots under both words', () => expect(ids(REAL[0], REAL)).toEqual(['sound_dots']));

  it('word chains: the changed letter only where the tier hid it, dots, then the short chain', () => {
    expect(ids(CHAIN[0], CHAIN)).toEqual(['sound_dots', 'short_chain']);
    expect(ids(CHAIN[1], CHAIN)).toEqual(['changed_letter', 'sound_dots', 'short_chain']);
    expect(ids({ ...CHAIN[1], chainCueLevel: 'full' }, CHAIN)).toEqual(['sound_dots', 'short_chain']);
    expect(nextLever(wordWorkoutLevers(CHAIN[1], [], CHAIN, ['a', 'o']), 'previous_word')).toBe('changed_letter');
    expect(nextLever(wordWorkoutLevers(CHAIN[1], ['changed_letter', 'sound_dots'], CHAIN, ['a', 'o']), 'previous_word')).toBe('short_chain');
  });

  it('inflected: the divider, then an easier ending; compound: the divider only', () => {
    const ing = inflected('jumping');
    expect(ids(ing[0], ing)).toEqual(['chunk_divider', 'easier_ending']);
    const compound = itemsFromChallenges([{ id: 'k', mode: 'compound-word', targetWord: 'sunset' }]);
    expect(ids(compound[0], compound)).toEqual(['chunk_divider']);
    expect(nextLever(wordWorkoutLevers(ing[0], [], ing, ['a', 'e', 'i', 'o', 'u']), 'base_only')).toBe('chunk_divider');
  });

  it('sentence reading: the underline and the short sentence; the question gets a kind-of-answer icon', () => {
    expect(ids(SENTENCE[0], SENTENCE)).toEqual(['tracking_underline', 'three_word_sentence']);
    expect(ids(SENTENCE[1], SENTENCE)).toEqual(['question_word_icon']);
    expect(questionIcon(SENTENCE[1])).toMatchObject({ icon: '📍' });
    expect(questionIcon({ ...SENTENCE[1], question: 'Why did it sit?' })).toBeNull();
  });

  it('every lever is shown (no audio of unread print), says nothing is read, and answers only catalog misses', () => {
    const entry = LITERACY_CATALOG.find(c => c.id === 'word-workout')!.teachingWorkspace!;
    const all = [...REAL, ...CHAIN, ...SENTENCE, ...inflected('jumping')];
    for (const item of all) {
      for (const l of wordWorkoutLevers(item, [], all, ['a', 'e', 'i', 'o', 'u'])) {
        expect(l.carrier).toBe('shown');
        if (l.kind === 'help' && l.id !== 'question_word_icon') expect(l.does).toMatch(/Nothing is said/);
        for (const miss of l.answers ?? []) expect(entry.misses![wordWorkoutEvalMode(item)]).toContain(miss);
      }
    }
    for (const [mode, misses] of Object.entries(WORD_WORKOUT_SPOKEN_MISSES)) {
      expect(entry.misses![mode]).toEqual(misses);
      expect(entry.unanswered![mode]).toEqual(misses);
    }
    expect(entry.levers).toBe(true);
  });
});
