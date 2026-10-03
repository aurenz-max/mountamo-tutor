/**
 * The DI reading packs' spoken miss lists (handoff 20 Part B): each item's ids in precedence order, and no listed
 * example is an answer the item accepts (its key, its ASR aliases).
 */
import { describe, expect, it } from 'vitest';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { buildLetterSoundItems, diLetterSoundSpokenMisses, type DiLetterSoundChallenge } from './diLetterSoundsDomain';
import { buildWordReadingItems, diWordReadingSpokenMisses, type DiWordReadingChallenge } from './diWordReadingDomain';
import { diSentenceSpokenMisses, type SentenceReadingItem } from './diSentenceReadingDomain';

const sound = (c: Partial<DiLetterSoundChallenge>) => diLetterSoundSpokenMisses(buildLetterSoundItems([{ id: 'x', challengeType: 'letter_sound',
  letter: 'm', spoken: 'mmm', keyword: 'moon', emoji: '', elicitation: 'isolated', ...c } as DiLetterSoundChallenge])[0]);
const word = (c: Partial<DiWordReadingChallenge>) => diWordReadingSpokenMisses(buildWordReadingItems([{ id: 'x', challengeType: 'read_word',
  word: 'cat', wordType: 'cvc', graphemes: ['c', 'a', 't'], ...c } as DiWordReadingChallenge])[0]);
const sentence = (text: string) => diSentenceSpokenMisses({ text } as SentenceReadingItem);

type Case = [string, () => KnownMiss[], string[], string[]];
const CASES: Case[] = [
  ['held letter m', () => sound({}), ['keyword_word', 'letter_name', 'added_vowel', 'other_sound'], ['mmm', 'm', 'mm', 'hmm']],
  ['held letter s: its name transcribes like the sound', () => sound({ letter: 's', spoken: 'sss', keyword: 'sun' }),
    ['keyword_word', 'added_vowel', 'other_sound'], ['sss', 's', 'ess']],
  ['clipped letter t', () => sound({ letter: 't', spoken: 't', keyword: 'top', articulation: 'clipped' }), ['letter_name', 'other_sound'], ['t', 'top']],
  ['short vowel a: its keyword counts (R5)', () => sound({ letter: 'a', spoken: 'aaa', keyword: 'apple', elicitation: 'keyword' }), ['letter_name', 'other_sound'], ['aaa', 'apple']],
  ['first sound in moon', () => sound({ challengeType: 'first_sound_in_word' }),
    ['keyword_word', 'letter_name', 'added_vowel', 'last_sound', 'other_sound'], ['mmm', 'm']],
  ['decodable cat', () => word({}), ['letter_name', 'sounds_no_word', 'first_sound_changed', 'middle_sound_changed', 'last_sound_changed'], ['cat']],
  ['decodable red: "read" is heard as red', () => word({ word: 'red', graphemes: ['r', 'e', 'd'] }),
    ['letter_name', 'sounds_no_word', 'first_sound_changed', 'middle_sound_changed', 'last_sound_changed'], ['red', 'read']],
  ['sight word was', () => word({ word: 'was', wordType: 'sight', graphemes: undefined, challengeType: 'sight_word' }),
    ['letter_name', 'sounds_no_word', 'read_backwards', 'similar_word'], ['was']],
  ['sight word go', () => word({ word: 'go', wordType: 'sight', graphemes: undefined, challengeType: 'sight_word' }),
    ['letter_name', 'sounds_no_word', 'similar_word'], ['go']],
  ['sentence with a small word', () => sentence('Here it is.'), ['word_skip', 'word_swap'], ['Here it is.', 'here it is']],
  ['sentence of CVC words', () => sentence('The cat sat.'), ['word_skip', 'word_swap'], ['The cat sat.', 'the cat sat']],
];

describe('DI reading spoken misses', () => {
  it.each(CASES)('%s', (_name, misses, ids, correct) => {
    const list = misses();
    expect(list.map(m => m.id)).toEqual(ids);
    const said = new Set(correct.map(c => c.toLowerCase()));
    for (const m of list) for (const e of m.examples ?? []) expect(said.has(e.toLowerCase()), `${m.id} example "${e}"`).toBe(false);
  });
});
