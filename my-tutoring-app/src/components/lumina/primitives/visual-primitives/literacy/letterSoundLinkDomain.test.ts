import { expect, it } from 'vitest';
import { acceptedFor, letterSoundMiss, letterSoundSpokenMisses, type LetterSoundItem } from './letterSoundLinkDomain';

const hear = (answer: string) => ({ id: 'l', mode: 'hear-see', answer }) as LetterSoundItem;
it.each([
  [hear('a'), 'A', undefined], [hear('a'), 'e', 'other_short_vowel'], [hear('i'), 'u', 'other_short_vowel'],
  [hear('t'), 'd', 'voicing_partner'], [hear('b'), 'p', 'voicing_partner'], [hear('g'), 'c', 'voicing_partner'],
  [hear('s'), 'n', 'other_letter'], [hear('p'), 'n', 'other_letter'], [hear('a'), 't', 'other_letter'],
  [{ ...hear('s'), mode: 'see-hear' } as LetterSoundItem, 'n', undefined],
] as const)('%s / %s', (item, tapped, miss) => {
  expect(letterSoundMiss(item, tapped)).toBe(miss);
});

const see = (letter: string, spoken: string, keyword: string) => ({ id: 's', mode: 'see-hear', letter, spoken, keyword }) as LetterSoundItem;
// see-hear's known wrong answers (handoff 20 Part B): a clipped sound accepts its keyword, so it is not a miss there.
it.each([
  [see('s', 'sss', 'sun'), ['letter_name', 'keyword_word', 'added_vowel', 'other_sound']],
  [see('a', 'aaa', 'apple'), ['letter_name', 'keyword_word', 'other_sound']],
  [see('t', 't', 'top'), ['letter_name', 'other_sound']],
  [{ id: 'k', mode: 'keyword-match', letter: 'm', spoken: 'mmm', keyword: 'moon', answer: 'moon', distractor: 'sun' } as LetterSoundItem,
    ['other_picture', 'letter_name', 'said_the_sound']],
  [hear('a'), []],
] as const)('%#: spoken misses', (item, ids) => {
  const misses = letterSoundSpokenMisses(item);
  expect(misses.map(m => m.id)).toEqual(ids);
  const accepted = (acceptedFor(item) ?? '').split(' or ');
  for (const m of misses) for (const e of m.examples ?? []) expect(accepted).not.toContain(e);
});
