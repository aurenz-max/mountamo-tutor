/**
 * The picture-match levers' leak rules, the practice builder, and "this wrong tap, then this lever"
 * (`/add-support-tiers`, handoff 22 L1).
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { PRACTICE_WORDS } from './cvcSpellerLevers';
import type { WordWorkoutItem } from './wordWorkoutScript';
import { wordWorkoutMiss } from './wordWorkoutWorkspace';
import { dotsLeak, graphemes, lessonVowels, practiceLeak, twoFarPictures, wordWorkoutLevers } from './wordWorkoutLevers';

const pic = (id: string, word: string, emoji: string, ...foils: Array<[string, string]>): WordWorkoutItem => ({
  id, kind: 'picture_tap', answerKind: 'gesture', responseClass: 'manipulation', action: 'picture_tap', targetWord: word,
  options: [{ word, emoji }, ...foils.map(([w, e]) => ({ word: w, emoji: e }))] }) as unknown as WordWorkoutItem;

describe('sound dots', () => {
  it.each([['pig', ['p', 'i', 'g']], ['ship', ['sh', 'i', 'p']], ['duck', ['d', 'u', 'ck']], ['cats', ['c', 'a', 't', 's']]])
  ('%s: one dot per grapheme, the word\'s own letters in order', (word, dots) => {
    expect(graphemes(word)).toEqual(dots);
    expect(dotsLeak(word, graphemes(word))).toBe(false);
  });
});

describe('the practice item', () => {
  it.each([['a'], ['i'], ['a', 'i'], ['a', 'e', 'i', 'o', 'u']])('vowels %j: every pool word as the item gets an in-scope word and a far foil', (...vowels) => {
    for (const p of PRACTICE_WORDS) {
      const items = [pic('a', p.word, p.emoji, ['pin', '📌']), pic('b', 'hen', '🐔', ['hat', '🎩'])];
      const practice = twoFarPictures(items[0], items, vowels);
      if (!practice) continue;
      expect(practiceLeak(practice, items, vowels)).toBe(false);
      expect(practice.id).toBe('a~simpler');
      expect(practice.options).toHaveLength(2);
      for (const o of practice.options!) expect(o.word.split('').filter(l => 'aeiou'.includes(l)).every(v => vowels.includes(v))).toBe(true);
      const foil = practice.options!.find(o => o.word !== practice.targetWord)!;
      expect(foil.word[0]).not.toBe(practice.targetWord![0]);
      expect(foil.word.slice(-1)).not.toBe(practice.targetWord!.slice(-1));
    }
  });

  it('an a/i lesson on pig / pin / bin practises map, never sun', () => {
    const items = [pic('p', 'pig', '🐷', ['pin', '📌'], ['bin', '🗑️'])];
    expect(twoFarPictures(items[0], items, ['a', 'i'])).toMatchObject({ targetWord: 'map' });
    expect(practiceLeak({ ...items[0], targetWord: 'sun', options: [{ word: 'sun', emoji: '☀️' }, { word: 'map', emoji: '🗺️' }] } as never, items, ['a', 'i'])).toBe(true);
    expect(lessonVowels([], items)).toEqual(['i']);
    expect(lessonVowels(['a', 'i'], items)).toEqual(['a', 'i']);
  });
});

describe('levers and the miss they answer', () => {
  const items = [pic('p', 'pig', '🐷', ['pin', '📌'], ['big', '🐘'], ['pet', '🐶'])];
  it.each([['pin', 'same_start'], ['big', 'same_end'], ['pet', 'same_start']])('%s: %s, then the dots', (tapped, miss) => {
    expect(wordWorkoutMiss(items[0], tapped)).toBe(miss);
    expect(nextLever(wordWorkoutLevers(items[0], [], items, ['a', 'i']), miss)).toBe('sound_dots');
  });

  it('with the dots pulled, the practice item is next; real-or-silly gets the dots only', () => {
    expect(nextLever(wordWorkoutLevers(items[0], ['sound_dots'], items, ['a', 'i']), 'same_end')).toBe('two_far_pictures');
    expect(wordWorkoutLevers({ ...items[0], kind: 'real_word' } as WordWorkoutItem, [], items, ['a', 'i']).map(l => l.id)).toEqual(['sound_dots']);
  });
});
