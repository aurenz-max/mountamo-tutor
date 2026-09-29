/**
 * word-sorter's levers (`/add-support-tiers`, handoff 22 L4): offered only where the tier withdrew the aid, no group
 * picture that is the item's own, and every catalog miss answered or unanswered by decision.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { LITERACY_CATALOG } from '../../../service/manifest/catalog/literacy';
import { itemsFromChallenge, type WordSorterChallengeLike } from './wordSorterScript';
import { FILED_LEVER, PICTURES_LEVER, groupPicturesLeak, leversOnScreen, wordSorterLevers } from './wordSorterLevers';

const SORT: WordSorterChallengeLike = { id: 'c', type: 'ternary_sort', bucketLabels: ['Animals', 'Food', 'Toys'],
  bucketEmojis: ['🐾', '🍎', '🧸'], showBucketEmojis: false, showFiledWords: false,
  words: [{ id: 'a', word: 'cow', emoji: '🐄', correctBucket: 'Animals' }, { id: 'b', word: 'ball', emoji: '⚽', correctBucket: 'Toys' },
    { id: 'c', word: 'apple', emoji: '🍎', correctBucket: 'Food' }] };
const MATCH: WordSorterChallengeLike = { id: 'm', type: 'match_pairs', relationLabel: 'opposite', showFiledWords: false,
  pairs: [{ id: 'p', term: 'big', match: 'small' }, { id: 'q', term: 'hot', match: 'cold' }] };
const entry = LITERACY_CATALOG.find(x => x.id === 'word-sorter')!.teachingWorkspace!;

describe('word-sorter levers', () => {
  it('the tier is the starting position; a pre-reader and an easy item offer no pictures lever', () => {
    const [cow] = itemsFromChallenge(SORT);
    expect(wordSorterLevers(cow, [], 0).map(l => l.id)).toEqual([PICTURES_LEVER]);
    expect(wordSorterLevers(cow, [], 1).map(l => l.id)).toEqual([PICTURES_LEVER, FILED_LEVER]);
    expect(wordSorterLevers(itemsFromChallenge(SORT, { isPreReader: true })[0], [], 1).map(l => l.id)).toEqual([FILED_LEVER]);
    expect(wordSorterLevers(itemsFromChallenge({ ...SORT, showBucketEmojis: true, showFiledWords: true })[0], [], 1)).toEqual([]);
  });

  it('leak: an item whose own picture is a group picture gets no pictures lever', () => {
    const apple = itemsFromChallenge(SORT)[2];
    expect(groupPicturesLeak(apple)).toBe(true);
    expect(wordSorterLevers(apple, [], 0)).toEqual([]);
    expect(groupPicturesLeak(itemsFromChallenge(SORT)[0])).toBe(false);
  });

  it('no lever text or fact names the answer', () => {
    for (const item of [...itemsFromChallenge(SORT), ...itemsFromChallenge(MATCH)]) {
      const ls = wordSorterLevers(item, [], 1);
      const text = [...ls.map(l => `${l.when} ${l.does}`), leversOnScreen(item, ls.map(l => l.id)) ?? ''].join(' ');
      expect(text).not.toContain(item.answer);
      for (const l of ls) expect(l.carrier).toBe('shown');
    }
  });

  it('every catalog miss is answered on a hard item with filed work, or unanswered by decision', () => {
    expect(entry.levers).toBe(true);
    for (const [mode, item] of [['ternary_sort', itemsFromChallenge(SORT)[0]], ['match_pairs', itemsFromChallenge(MATCH)[0]]] as const) {
      const ls = wordSorterLevers(item, [], 1);
      for (const miss of entry.misses![mode]) {
        const answered = ls.some(l => l.answers?.includes(miss));
        expect(answered !== (entry.unanswered?.[mode] ?? []).includes(miss), `${mode} ${miss}`).toBe(true);
      }
    }
    const ls = wordSorterLevers(itemsFromChallenge(SORT)[0], [], 1);
    expect(nextLever(ls, 'said_word_back')).toBe(PICTURES_LEVER);
    expect(nextLever(ls, 'other_group', 'help')).toBe(PICTURES_LEVER);
  });
});
