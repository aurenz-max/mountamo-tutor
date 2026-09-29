/**
 * Support-tier unit tests for the word-sorter generator (/add-support-tiers).
 *
 * The tier is SCAFFOLD WITHDRAWAL: it changes how much help is shown, never which
 * words/categories are drawn and never which bucket is correct. These tests pin
 * the two pure resolvers the generator stamps from — the scaffold table (including
 * the K band floor) and the match-column distractor selector (including every
 * answer-leak guard).
 */
import { describe, expect, it } from 'vitest';
import {
  resolveWordSorterSupport,
  reconstructSortChallenge,
  selectDistractorMatches,
  type DistractorMatch,
} from './gemini-word-sorter';

describe('resolveWordSorterSupport — scaffold withdrawal table', () => {
  it('easy = full help at a reading grade', () => {
    expect(resolveWordSorterSupport('easy', '2')).toEqual({
      showBucketEmojis: true,
      showFiledWords: true,
      namesSortCriterion: true,
      distractorMatchCount: 0,
    });
  });

  it('medium withdraws nothing but raises the match-column discrimination load by one', () => {
    expect(resolveWordSorterSupport('medium', '2')).toEqual({
      showBucketEmojis: true,
      showFiledWords: true,
      namesSortCriterion: true,
      distractorMatchCount: 1,
    });
  });

  it('hard withdraws bucket emoji, filed words, and the named criterion, and adds 2 distractors', () => {
    expect(resolveWordSorterSupport('hard', '2')).toEqual({
      showBucketEmojis: false,
      showFiledWords: false,
      namesSortCriterion: false,
      distractorMatchCount: 2,
    });
  });

  it('BAND FLOOR: at K the bucket emoji are forced ON at every tier (pre-reader answer surface)', () => {
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      expect(resolveWordSorterSupport(tier, 'K').showBucketEmojis).toBe(true);
    }
    // …and hard still withdraws the K-safe levers, so the tier is not inert at K.
    expect(resolveWordSorterSupport('hard', 'K')).toMatchObject({
      showBucketEmojis: true,
      showFiledWords: false,
      namesSortCriterion: false,
    });
  });

  it('the bucket-label COUNT is not a tier lever — the scaffold carries no bucket-count field', () => {
    const keys = Object.keys(resolveWordSorterSupport('hard', '2')).sort();
    expect(keys).toEqual([
      'distractorMatchCount', 'namesSortCriterion', 'showBucketEmojis', 'showFiledWords',
    ]);
  });
});

describe('selectDistractorMatches — the match column never leaks', () => {
  const pairs = [
    { term: 'cat', match: 'cats', matchEmoji: '🐱' },
    { term: 'dog', match: 'dogs', matchEmoji: '🐶' },
    { term: 'box', match: 'boxes', matchEmoji: '📦' },
  ];
  const pool: DistractorMatch[] = [
    { id: 'd0', text: 'birds', emoji: '🐦' },
    { id: 'd1', text: 'trees', emoji: '🌳' },
  ];

  it('returns nothing at easy (count 0) — legacy match column', () => {
    expect(selectDistractorMatches(pairs, pool, 0)).toEqual([]);
  });

  it('returns exactly `count` decoys, deterministically, in pool order', () => {
    expect(selectDistractorMatches(pairs, pool, 1)).toEqual([{ id: 'd0', text: 'birds', emoji: '🐦' }]);
    expect(selectDistractorMatches(pairs, pool, 2).map(d => d.id)).toEqual(['d0', 'd1']);
    // Deterministic: same inputs, same output, every call.
    expect(selectDistractorMatches(pairs, pool, 2)).toEqual(selectDistractorMatches(pairs, pool, 2));
  });

  it('drops a decoy that duplicates a real match or a real term (it would be a correct-looking answer)', () => {
    const leaky: DistractorMatch[] = [
      { id: 'd0', text: 'Dogs', emoji: '🐶' }, // == a real match, different case
      { id: 'd1', text: 'cat', emoji: '🐱' },  // == a real term
      { id: 'd2', text: 'birds', emoji: '🐦' },
    ];
    expect(selectDistractorMatches(pairs, leaky, 2)).toEqual([{ id: 'd2', text: 'birds', emoji: '🐦' }]);
  });

  it('drops an emoji-less decoy when every real match has an emoji (spottable without solving)', () => {
    const mixed: DistractorMatch[] = [
      { id: 'd0', text: 'birds' },              // no emoji → stands out → dropped
      { id: 'd1', text: 'trees', emoji: '🌳' },
    ];
    expect(selectDistractorMatches(pairs, mixed, 2)).toEqual([{ id: 'd1', text: 'trees', emoji: '🌳' }]);
  });

  it('strips decoy emoji when NO real match has one (an emoji would stand out the other way)', () => {
    const bare = [
      { term: 'cat', match: 'cats' },
      { term: 'dog', match: 'dogs' },
    ];
    expect(selectDistractorMatches(bare, pool, 2)).toEqual([
      { id: 'd0', text: 'birds' },
      { id: 'd1', text: 'trees' },
    ]);
  });

  it('never invents decoys — an empty pool yields none even at hard', () => {
    expect(selectDistractorMatches(pairs, [], 2)).toEqual([]);
  });
});

// WS-2 (handoff 28): the saved K ternary payload gave cards their group's picture.
describe('reconstructSortChallenge — a card never shows its group picture', () => {
  const flat = {
    id: 'ternary_sort-0', instruction: 'Sort these words into cats, dogs, and snacks!',
    bucket0: 'Cats', bucket1: 'Dogs', bucket2: 'Food', bucket0Emoji: '🐱', bucket1Emoji: '🐶', bucket2Emoji: '🍎',
    wordCount: 9,
    word0Text: 'hound', word0Emoji: '🦴', word0Bucket: 'Dogs',
    word1Text: 'pie', word1Emoji: '🥧', word1Bucket: 'Food',
    word2Text: 'kit', word2Emoji: '🐈', word2Bucket: 'Cats',
    word3Text: 'pup', word3Emoji: '🐶', word3Bucket: 'Dogs',
    word4Text: 'milk', word4Emoji: '🥛', word4Bucket: 'Food',
    word5Text: 'kitty', word5Emoji: '🐱️', word5Bucket: 'Cats',
    word6Text: 'fish', word6Emoji: '🐟', word6Bucket: 'Food',
    word7Text: 'dog', word7Emoji: '🐕', word7Bucket: 'Dogs',
    word8Text: 'tom', word8Emoji: '🐈‍⬛', word8Bucket: 'Cats',
  };

  it('skips a word whose picture is a mat picture, even with a variation selector; keeps a different picture of the group', () => {
    const c = reconstructSortChallenge(flat, 'ternary_sort')!;
    const kept = (c.words ?? []).map((w) => w.word).sort();
    expect(kept).toEqual(['dog', 'fish', 'hound', 'kit', 'milk', 'pie', 'tom']);
    const mats = new Set(c.bucketEmojis);
    expect((c.words ?? []).every((w) => !w.emoji || !mats.has(w.emoji))).toBe(true);
  });

  it('rejects the challenge when too few honest words survive', () => {
    const leaky = { ...flat, word0Emoji: '🐶', word1Emoji: '🍎', word2Emoji: '🐱' };
    expect(reconstructSortChallenge(leaky, 'ternary_sort')).toBeNull();
  });
});
