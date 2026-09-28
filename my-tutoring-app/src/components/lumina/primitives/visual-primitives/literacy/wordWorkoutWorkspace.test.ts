import { expect, it } from 'vitest';
import { wordWorkoutMiss } from './wordWorkoutWorkspace';
import type { WordWorkoutItem } from './wordWorkoutScript';

const tap = (targetWord: string) => ({ id: 'w', kind: 'picture_tap', targetWord }) as WordWorkoutItem;
it.each([
  [tap('cat'), 'cat', undefined], [tap('pin'), 'pig', 'same_start'], [tap('cat'), 'cup', 'same_start'],
  [tap('cat'), 'bat', 'same_end'], [tap('cat'), 'rat', 'same_end'], [tap('hen'), 'bed', 'same_vowel'],
  [tap('cat'), 'dog', 'other_word'], [tap('sun'), 'hat', 'other_word'],
  [{ ...tap('cat'), kind: 'read_word' } as unknown as WordWorkoutItem, 'bat', undefined],
] as const)('%#', (item, tapped, miss) => {
  expect(wordWorkoutMiss(item, tapped)).toBe(miss);
});
