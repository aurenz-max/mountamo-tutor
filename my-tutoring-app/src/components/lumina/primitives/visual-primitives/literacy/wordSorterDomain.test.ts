/**
 * word-sorter's domain: the build gates (drop, never repair), the bank that never shrinks, the ask and its key.
 * The cue-pack tests went with the cues (boss migration 10-19); the boss guards check the assignment.
 */
import { describe, it, expect } from 'vitest';
import { askLeaks } from '../../../components/live-activity/spokenKey';
import {
  MAX_ITEMS_PER_CHALLENGE, MAX_ITEMS_PER_SESSION, askFor, choicesPhrase, hearQuestionRequest, isSayableLabel, isSayableWord,
  itemsFromChallenge, itemsFromChallenges, normalizeRelation, optionsEarSeparable, wordSorterKey, wordSorterScene,
  wordSorterSpokenMisses, type WordSorterChallengeLike,
} from './wordSorterDomain';

const BINARY_RAW: WordSorterChallengeLike = {
  id: 'ws-b1', type: 'binary_sort', bucketLabels: ['Animals', 'Food'], bucketEmojis: ['🐾', '🍎'],
  words: [
    { id: 'w0', word: 'dog', emoji: '🐕', correctBucket: 'Animals' },
    { id: 'w1', word: 'bread', emoji: '🍞', correctBucket: 'Food' },
    { id: 'w2', word: 'cat', emoji: '🐈', correctBucket: 'Animals' },
    { id: 'w3', word: 'apple', emoji: '🍏', correctBucket: 'Food' },
  ],
};
const TERNARY_RAW: WordSorterChallengeLike = {
  id: 'ws-t1', type: 'ternary_sort', bucketLabels: ['Animals', 'Food', 'Toys'], bucketEmojis: ['🐾', '🍎', '🧸'],
  words: [
    { id: 'w0', word: 'horse', correctBucket: 'Animals' },
    { id: 'w1', word: 'rice', correctBucket: 'Food' },
    { id: 'w2', word: 'ball', correctBucket: 'Toys' },
  ],
};
const MATCH_RAW: WordSorterChallengeLike = {
  id: 'ws-m1', type: 'match_pairs', relationLabel: 'opposite',
  pairs: [{ id: 'p0', term: 'big', match: 'small' }, { id: 'p1', term: 'hot', match: 'cold' }, { id: 'p2', term: 'up', match: 'down' }],
  distractorMatches: [{ id: 'd0', text: 'wet' }],
};
const build = (challenges: WordSorterChallengeLike[], opts: Parameters<typeof itemsFromChallenges>[1] = {}) =>
  itemsFromChallenges(challenges, opts);

describe('the ask and its key', () => {
  it('a sort ask names its groups, and its key is that menu', () => {
    const [item] = build([BINARY_RAW]);
    expect(item.namesChoices).toBe(true);
    expect(askFor(item)).toContain('Animals, or Food?');
    expect(wordSorterKey(item).menu).toEqual(['Animals', 'Food']);
    expect(askLeaks(askFor(item), wordSorterKey(item))).toEqual([]);
  });

  it('at hard for a reader the ask names no group, still states its problem, and leaks nothing', () => {
    const [item] = build([{ ...BINARY_RAW, namesSortCriterion: false }], { tier: 'hard', isPreReader: false });
    expect(item.namesChoices).toBe(false);
    for (const label of item.choices) expect(askFor(item)).not.toContain(label);
    expect(askFor(item)).toContain('Which group does it belong with?');
    expect(wordSorterKey(item).menu).toBeUndefined();
    expect(askLeaks(askFor(item), wordSorterKey(item))).toEqual([]);
  });

  it('K band floor beats the tier: a pre-reader cannot read a mat', () => {
    const [item] = build([{ ...BINARY_RAW, namesSortCriterion: false }], { tier: 'hard', isPreReader: true });
    expect(item.namesChoices).toBe(true);
    expect(askFor(item)).toContain(choicesPhrase(item));
  });

  it('a match ask never speaks its printed bank, at any tier', () => {
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      for (const item of build([MATCH_RAW], { tier })) {
        for (const option of item.choices) expect(askFor(item)).not.toContain(option);
        expect(askLeaks(askFor(item), wordSorterKey(item))).toEqual([]);
      }
    }
    expect(askFor(build([MATCH_RAW])[0])).toContain('Which word means the opposite of big?');
  });

  it('names the word said back as the signature error, except where the word is a form of the group', () => {
    const [dog] = build([BINARY_RAW]);
    expect(wordSorterKey(dog).signatureError).toContain('"dog" said back');
    expect(wordSorterSpokenMisses(dog).map(m => m.id)).toEqual(['other_group', 'said_word_back']);
    const [cat] = itemsFromChallenge({ ...BINARY_RAW, bucketLabels: ['Cats', 'Food'],
      words: [{ id: 'a', word: 'cat', correctBucket: 'Cats' }, { id: 'b', word: 'bread', correctBucket: 'Food' }] });
    expect(wordSorterKey(cat).signatureError).not.toContain('said back');
    expect(wordSorterSpokenMisses(cat).map(m => m.id)).toEqual(['other_group']);
  });

  it('the scene and the hear-again request never name the answer outside the spoken menu', () => {
    for (const item of build([{ ...BINARY_RAW, namesSortCriterion: false }, MATCH_RAW], { tier: 'hard' })) {
      expect(hearQuestionRequest(item)).toContain(item.word);
      expect(hearQuestionRequest(item)).not.toContain(item.answer);
      const { constraints, namingChoices, word } = wordSorterScene(item).facts as Record<string, string>;
      expect(`${constraints} ${namingChoices} ${word}`).not.toContain(item.answer);
    }
  });
});

describe('the word bank', () => {
  it('offers the SAME whole bank on every item: no answer is reachable by elimination', () => {
    const items = build([MATCH_RAW]);
    expect(items.length).toBe(3);
    expect(new Set(items.map(i => i.choices.join('|'))).size).toBe(1);
    expect(items[0].choices).toEqual(expect.arrayContaining(['small', 'cold', 'down', 'wet']));
    for (const item of items) expect(item.choices.filter(c => c === item.answer)).toHaveLength(1);
  });

  it('reads the relation off the challenge and asks a real question with it', () => {
    expect(normalizeRelation('opposites')).toBe('opposite');
    expect(normalizeRelation('singular to plural')).toBe('plural');
    expect(normalizeRelation('rhyming words')).toBe('rhyme');
    expect(normalizeRelation('mystery')).toBe('partner');
    const [plural] = build([{ ...MATCH_RAW, relationLabel: 'plural' }]);
    expect(askFor(plural)).toContain('Which word means more than one big?');
  });
});

describe('build gates', () => {
  it('drops a challenge whose labels are not sayable', () => {
    expect(isSayableLabel('Animals')).toBe(true);
    expect(isSayableLabel('Things that are alive and can move on their own')).toBe(false);
    expect(isSayableLabel('Nouns (naming words)')).toBe(false);
    expect(itemsFromChallenge({ ...BINARY_RAW, bucketLabels: ['Animals', 'Things you can eat quickly at noon'] })).toEqual([]);
  });

  it('drops a challenge whose labels cannot be told apart by ear', () => {
    expect(optionsEarSeparable(['Big', 'Small'])).toBe(true);
    expect(optionsEarSeparable(['Big', 'Big Things'])).toBe(false);
    expect(itemsFromChallenge({ ...BINARY_RAW, bucketLabels: ['Big', 'Big Things'],
      words: [{ id: 'w0', word: 'ant', correctBucket: 'Big' }, { id: 'w1', word: 'bus', correctBucket: 'Big Things' }] })).toEqual([]);
  });

  it('drops a word that is also a group label: the ask would be a riddle', () => {
    const items = itemsFromChallenge({ ...BINARY_RAW,
      words: [...(BINARY_RAW.words ?? []), { id: 'w9', word: 'Animals', correctBucket: 'Food' }] });
    expect(items.map(i => i.word)).not.toContain('Animals');
  });

  it('drops a sort whose surviving words all land in ONE group', () => {
    expect(itemsFromChallenge({ ...BINARY_RAW,
      words: [{ id: 'w0', word: 'dog', correctBucket: 'Animals' }, { id: 'w1', word: 'cat', correctBucket: 'Animals' }] })).toEqual([]);
  });

  it('refuses anything that opens with a verdict sentinel', () => {
    expect(isSayableWord('yes')).toBe(false);
    expect(isSayableLabel('Yes Words')).toBe(false);
    const items = itemsFromChallenge({ ...MATCH_RAW,
      pairs: [{ id: 'p0', term: 'big', match: 'small' }, { id: 'p1', term: 'hot', match: 'cold' }, { id: 'p2', term: 'yes', match: 'no' }] });
    expect(items.map(i => i.word)).not.toContain('yes');
  });

  it('drops a match challenge whose bank is not ear-separable', () => {
    expect(optionsEarSeparable(['ice cream', 'ice', 'down'])).toBe(false);
    expect(itemsFromChallenge({ ...MATCH_RAW, distractorMatches: [],
      pairs: [{ id: 'p0', term: 'cone', match: 'ice cream' }, { id: 'p1', term: 'cube', match: 'ice' }, { id: 'p2', term: 'up', match: 'down' }] }))
      .toEqual([]);
  });

  it('caps a long challenge while still reaching every group', () => {
    const items = itemsFromChallenge({ ...TERNARY_RAW, words: [
      { id: 'w0', word: 'horse', correctBucket: 'Animals' }, { id: 'w1', word: 'cow', correctBucket: 'Animals' },
      { id: 'w2', word: 'goat', correctBucket: 'Animals' }, { id: 'w3', word: 'sheep', correctBucket: 'Animals' },
      { id: 'w4', word: 'rice', correctBucket: 'Food' }, { id: 'w5', word: 'bread', correctBucket: 'Food' },
      { id: 'w6', word: 'ball', correctBucket: 'Toys' }, { id: 'w7', word: 'kite', correctBucket: 'Toys' },
    ] });
    expect(items).toHaveLength(MAX_ITEMS_PER_CHALLENGE);
    expect(new Set(items.map(i => i.answer))).toEqual(new Set(['Animals', 'Food', 'Toys']));
  });

  it('caps the SESSION and keeps every item id unique', () => {
    expect(build([BINARY_RAW, TERNARY_RAW, MATCH_RAW, BINARY_RAW, TERNARY_RAW]).length).toBeLessThanOrEqual(MAX_ITEMS_PER_SESSION);
    const items = build([BINARY_RAW, TERNARY_RAW]);
    expect(new Set(items.map(i => i.id)).size).toBe(items.length);
  });
});
