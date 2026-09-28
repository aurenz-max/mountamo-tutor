import { expect, it } from 'vitest';
import { letterSpotterMiss } from './letterSpotterWorkspace';
import type { LetterSpotterItem } from './letterSpotterScript';

const item = (mode: LetterSpotterItem['mode'], targetLetter: string) => ({ id: 's', mode, targetLetter }) as LetterSpotterItem;
it.each([
  [item('match-it', 'b'), 'b', undefined], [item('match-it', 'b'), 'd', 'mirror_form'], [item('match-it', 'q'), 'p', 'mirror_form'],
  [item('match-it', 'n'), 'u', 'mirror_form'], [item('match-it', 'n'), 'h', 'same_shape_family'], [item('match-it', 'b'), 's', 'other_letter'],
  [item('find-it', 's'), 'S', undefined], [item('find-it', 's'), 'A', 'same_shape_family'], [item('find-it', 'b'), 'D', 'same_shape_family'],
  [item('find-it', 't'), 'P', 'other_letter'], [item('find-it', 't'), 'I', 'same_shape_family'],
  [item('name-it', 'a'), 'e', undefined],
] as const)('%#', (it_, tapped, miss) => {
  expect(letterSpotterMiss(it_, tapped)).toBe(miss);
});
