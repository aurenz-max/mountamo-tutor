/**
 * word-workout's domain (`wordWorkoutDomain.ts`): the build gates that drop an unaskable challenge, one challenge
 * becoming several items, the ask that never names the print, the key, the scene and the picture check. Moved here
 * from the scripted pack's suite when the family went onto its boss (10-20); the scripted cue assertions went with
 * the cues.
 */
import { describe, expect, it } from 'vitest';
import { askLeaks, containsPhrase } from '../../../components/live-activity/spokenKey';
import { spokenLeaksOf } from '../../../components/live-activity/boss';
import { EARLY_CONTEXT_TRIALS, EARLY_EXTENDED_WORDS } from './wordWorkoutEarlyDecoding';
import { wordWorkoutBoss } from './wordWorkout.boss';
import type { WordWorkoutData } from './WordWorkout';
import {
  MAX_SENTENCE_WORDS, MIN_SENTENCE_WORDS, answerKindFor, askFor, chainWordOf, challengeAskable, containsWord,
  hearQuestionRequest, isRealCvcWord, itemsFromChallenge, itemsFromChallenges, pairEarSeparable, responseClassFor,
  wordWorkoutGiven, wordWorkoutKey, wordWorkoutMiss, wordWorkoutScene, type WordWorkoutChallengeLike, type WordWorkoutItem,
} from './wordWorkoutDomain';

const RN1: WordWorkoutChallengeLike = { id: 'c1', mode: 'real-vs-nonsense', realWord: 'cat', nonsenseWord: 'zat' };
const RN2: WordWorkoutChallengeLike = { id: 'c2', mode: 'real-vs-nonsense', realWord: 'bed', nonsenseWord: 'zeb' };
const PM: WordWorkoutChallengeLike = { id: 'c3', mode: 'picture-match', targetWord: 'pig', targetImage: '🐷',
  distractorImages: [{ word: 'pin', image: '📌' }, { word: 'bin', image: '🗑️' }] };
const CHAIN: WordWorkoutChallengeLike = { id: 'c4', mode: 'word-chains', chain: ['cat', 'hat', 'hot', 'hop'], changedPositions: [0, 1, 2] };
const SR1: WordWorkoutChallengeLike = { id: 'c5', mode: 'sentence-reading', sentence: 'The cat sat on the mat.',
  cvcWords: ['cat', 'sat', 'mat'], sightWords: ['the', 'on'], comprehensionQuestion: 'Where did the cat sit?', comprehensionAnswer: 'mat' };
const ITEMS: WordWorkoutItem[] = itemsFromChallenges([RN1, RN2, PM, CHAIN, SR1]);
const byKind = (kind: WordWorkoutItem['kind']) => ITEMS.filter(i => i.kind === kind);
const first = (kind: WordWorkoutItem['kind']) => byKind(kind)[0];

describe('the items', () => {
  it('pins every kind\'s answer and class; picture_tap is the only gesture', () => {
    const expected: Array<[WordWorkoutItem['kind'], 'voice' | 'gesture', string]> = [
      ['real_word', 'voice', 'short_spoken_word'], ['picture_tap', 'gesture', 'manipulation'],
      ['chain_word', 'voice', 'short_spoken_word'], ['read_sentence', 'voice', 'sentence_read_aloud'],
      ['answer_question', 'voice', 'short_spoken_word'],
    ];
    for (const [kind, answerKind, responseClass] of expected) {
      expect(answerKindFor(kind)).toBe(answerKind);
      expect(responseClassFor(kind)).toBe(responseClass);
    }
    expect(ITEMS.filter(i => i.answerKind === 'gesture').map(i => i.kind)).toEqual(['picture_tap']);
  });

  it('one challenge is not one item: a chain is a read per word, a sentence is a read plus a question', () => {
    expect(itemsFromChallenge(CHAIN).map(i => i.id)).toEqual(['c4-w1', 'c4-w2', 'c4-w3', 'c4-w4']);
    expect(itemsFromChallenge(SR1).map(i => i.kind)).toEqual(['read_sentence', 'answer_question']);
    expect(itemsFromChallenge(RN1)).toHaveLength(1);
  });
});

describe('the print is never in the ask', () => {
  it('no ask names the print it asks the child to read; the comprehension ask never names its answer', () => {
    for (const item of byKind('real_word')) {
      expect(containsWord(askFor(item), item.realWord!)).toBe(false);
      expect(containsWord(askFor(item), item.nonsenseWord!)).toBe(false);
    }
    for (const item of byKind('chain_word')) expect(containsWord(askFor(item), chainWordOf(item))).toBe(false);
    for (const word of first('read_sentence').cvcWords ?? []) expect(containsWord(askFor(first('read_sentence')), word)).toBe(false);
    expect(containsWord(askFor(first('picture_tap')), 'pig')).toBe(false);
    const q = first('answer_question');
    expect(containsWord(askFor(q), q.answerWord!)).toBe(false);
    expect(askFor(q)).not.toContain(q.sentence);
  });

  it('hear-again repeats the ask and this item\'s never-say rule, never a word of the print', () => {
    for (const item of ITEMS) {
      const heard = hearQuestionRequest(item);
      expect(heard).toContain(askFor(item));
      expect(heard).not.toMatch(/\b(zat|zeb|hop|hot)\b/);
    }
  });

  it('every printed kind carries its never-say rule as a scene constraint', () => {
    for (const kind of ['real_word', 'picture_tap', 'chain_word', 'read_sentence', 'answer_question'] as const) {
      expect(wordWorkoutScene(first(kind)).facts.constraints, kind).toMatch(/do not (say|read)/i);
    }
    expect(JSON.stringify(wordWorkoutScene(first('real_word')))).not.toMatch(/\bcat\b|\bzat\b/);
  });

  it('every pool word and context trial passes the ask-leak check (no meaning sentence says its answer)', () => {
    const data: WordWorkoutData = { title: 'Pool', mode: 'inflected-word', masteredVowels: [], challenges: [
      ...EARLY_EXTENDED_WORDS.map(e => ({ id: e.word, mode: e.mode, targetWord: e.word, includeMeaning: true })),
      ...EARLY_CONTEXT_TRIALS.map(t => ({ id: t.id, mode: 'context-discrimination' as const, contextTrialId: t.id })),
    ] };
    // More challenges than one lesson carries, so the items are checked directly rather than through validate.
    expect(wordWorkoutBoss.items(data)).toHaveLength(EARLY_EXTENDED_WORDS.length * 2 + EARLY_CONTEXT_TRIALS.length * 3);
    expect(spokenLeaksOf(wordWorkoutBoss, data)).toEqual([]);
    // The meaning question is the only given, and it never holds the main answer.
    for (const item of wordWorkoutBoss.items(data).filter(i => i.kind === 'answer_word_meaning')) {
      expect(containsPhrase(wordWorkoutGiven(item).join(' '), item.answerWord!)).toBe(false);
      expect(askLeaks(askFor(item).replace(item.question ?? '', ''), wordWorkoutKey(item)!)).toEqual([]);
    }
  });
});

describe('the key and the picture check', () => {
  it('a picture tap has no key; every spoken item does, naming its fluent wrong answer', () => {
    expect(wordWorkoutKey(first('picture_tap'))).toBeNull();
    expect(wordWorkoutKey(first('real_word'))).toMatchObject({ answer: 'cat', signatureError: expect.stringContaining('"zat"') });
    expect(wordWorkoutKey(byKind('chain_word')[1])).toMatchObject({ answer: 'hat', signatureError: expect.stringContaining('"cat"') });
    expect(wordWorkoutKey(first('answer_question'))).toMatchObject({ answer: 'mat' });
  });

  it.each([
    ['cat', 'cat', undefined], ['pin', 'pig', 'same_start'], ['cat', 'cup', 'same_start'], ['cat', 'bat', 'same_end'],
    ['cat', 'rat', 'same_end'], ['hen', 'bed', 'same_vowel'], ['cat', 'dog', 'other_word'], ['sun', 'hat', 'other_word'],
  ] as const)('a tap on %s\'s %s picture: %s', (target, tapped, miss) => {
    expect(wordWorkoutMiss({ id: 'w', kind: 'picture_tap', targetWord: target } as WordWorkoutItem, tapped)).toBe(miss);
  });

  it('only a picture tap names a picture miss', () => {
    expect(wordWorkoutMiss({ id: 'w', kind: 'real_word', targetWord: 'cat' } as WordWorkoutItem, 'bat')).toBeUndefined();
  });
});

describe('build gates: drop an unaskable challenge, never repair it', () => {
  it('a real/nonsense pair that cannot be told apart BY EAR', () => {
    expect(pairEarSeparable('cat', 'zat')).toBe(true);
    expect(pairEarSeparable('cat', 'cak')).toBe(false);
    expect(pairEarSeparable('cat', 'zats')).toBe(false);
    expect(challengeAskable({ ...RN1, id: 'x', nonsenseWord: 'cak' })).toBe(false);
  });

  it('a pair whose "nonsense" word is a real word (the 08-14 probe\'s finding)', () => {
    expect(isRealCvcWord('pan')).toBe(true);
    expect(itemsFromChallenge({ ...RN1, id: 'x', realWord: 'ran', nonsenseWord: 'pan' })).toEqual([]);
    expect(itemsFromChallenge({ ...RN1, id: 'y', realWord: 'ran', nonsenseWord: 'zan' })).toHaveLength(1);
  });

  it('anything on the blocklist, wherever it appears', () => {
    expect(itemsFromChallenge({ ...RN1, id: 'x', realWord: 'bag', nonsenseWord: 'fag' })).toEqual([]);
    expect(itemsFromChallenge({ ...CHAIN, id: 'x', chain: ['bag', 'sag', 'sex'] })).toEqual([]);
    expect(itemsFromChallenge({ ...PM, id: 'x', distractorImages: [{ word: 'tit', image: '🐦' }] })).toEqual([]);
    expect(itemsFromChallenge({ ...SR1, id: 'x', sentence: 'The cat bit the ass.' })).toEqual([]);
  });

  it('a verdict-shaped word ("yes" is CVC) and a sentence opening with one', () => {
    expect(itemsFromChallenge({ ...RN1, id: 'x', realWord: 'yes', nonsenseWord: 'zes' })).toEqual([]);
    expect(itemsFromChallenge({ ...CHAIN, id: 'x', chain: ['yes', 'yet', 'net'] })).toEqual([]);
    expect(itemsFromChallenge({ ...SR1, id: 'x', sentence: 'Yes the cat sat on the mat.' })).toEqual([]);
  });

  it('a sentence outside the benched read-aloud window, at both ends', () => {
    expect([MIN_SENTENCE_WORDS, MAX_SENTENCE_WORDS]).toEqual([3, 8]);
    expect(itemsFromChallenge({ ...SR1, id: 'x', sentence: 'Sit.' })).toEqual([]);
    expect(itemsFromChallenge({ ...SR1, id: 'x', sentence: 'The big cat sat on the red mat in the sun.' })).toEqual([]);
  });

  it('a broken question without dropping the read', () => {
    expect(itemsFromChallenge({ ...SR1, id: 'x', comprehensionQuestion: 'What did the cat sit on, the mat?' }).map(i => i.kind))
      .toEqual(['read_sentence']);
    expect(itemsFromChallenge({ ...SR1, id: 'y', comprehensionAnswer: 'rug' }).map(i => i.kind)).toEqual(['read_sentence']);
  });

  it('a chain step that is not a one-letter substitution; a picture match with nothing to choose', () => {
    expect(itemsFromChallenge({ ...CHAIN, id: 'x', chain: ['cat', 'hop'] })).toEqual([]);
    expect(itemsFromChallenge({ ...CHAIN, id: 'x', chain: ['cat', 'cats'] })).toEqual([]);
    expect(itemsFromChallenge({ ...PM, id: 'x', distractorImages: [] })).toEqual([]);
    expect(itemsFromChallenge({ ...PM, id: 'x', targetImage: '' })).toEqual([]);
    expect(itemsFromChallenge({ ...PM, id: 'x', distractorImages: [{ word: 'pig', image: '🐖' }] })).toEqual([]);
  });

  it('drops without backfilling: a broken challenge shortens the session', () => {
    expect(itemsFromChallenges([RN1, { ...RN1, id: 'broken', nonsenseWord: 'cak' }, RN2]).map(i => i.id)).toEqual(['c1', 'c2']);
  });
});
