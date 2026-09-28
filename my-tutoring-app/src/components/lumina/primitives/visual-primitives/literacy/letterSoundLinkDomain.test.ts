import { expect, it } from 'vitest';
import { letterSoundMiss, type LetterSoundItem } from './letterSoundLinkDomain';

const hear = (answer: string) => ({ id: 'l', mode: 'hear-see', answer }) as LetterSoundItem;
it.each([
  [hear('a'), 'A', undefined], [hear('a'), 'e', 'other_short_vowel'], [hear('i'), 'u', 'other_short_vowel'],
  [hear('t'), 'd', 'voicing_partner'], [hear('b'), 'p', 'voicing_partner'], [hear('g'), 'c', 'voicing_partner'],
  [hear('s'), 'n', 'other_letter'], [hear('p'), 'n', 'other_letter'], [hear('a'), 't', 'other_letter'],
  [{ ...hear('s'), mode: 'see-hear' } as LetterSoundItem, 'n', undefined],
] as const)('%s / %s', (item, tapped, miss) => {
  expect(letterSoundMiss(item, tapped)).toBe(miss);
});
