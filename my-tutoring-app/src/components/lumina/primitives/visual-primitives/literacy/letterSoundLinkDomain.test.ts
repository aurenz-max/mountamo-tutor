import { expect, it } from 'vitest';
import { keyAnswers } from '../../../components/live-activity/spokenKey';
import { letterSoundKey, letterSoundMiss, letterSoundSpokenMisses, type LetterSoundItem } from './letterSoundLinkDomain';

const hear = (answer: string) => ({ id: 'l', mode: 'hear-see', answer }) as LetterSoundItem;
it.each([
  [hear('a'), 'A', undefined], [hear('a'), 'e', 'other_short_vowel'], [hear('i'), 'u', 'other_short_vowel'],
  [hear('t'), 'd', 'voicing_partner'], [hear('b'), 'p', 'voicing_partner'], [hear('g'), 'c', 'voicing_partner'],
  [hear('s'), 'n', 'other_letter'], [hear('p'), 'n', 'other_letter'], [hear('a'), 't', 'other_letter'],
  [{ ...hear('s'), mode: 'see-hear' } as LetterSoundItem, 'n', undefined],
] as const)('%s / %s', (item, tapped, miss) => {
  expect(letterSoundMiss(item, tapped)).toBe(miss);
});

const see = (letter: string, spoken: string, keyword: string) => ({ id: 's', mode: 'see-hear', letter, sound: `/${letter}/`, spoken, keyword }) as LetterSoundItem;
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
  const key = letterSoundKey(item);
  const accepted = key ? keyAnswers(key) : [];
  for (const m of misses) for (const e of m.examples ?? []) expect(accepted).not.toContain(e);
});

it('hear-see has no key: the activity checks the tap and the tutor is never told the letter', () => {
  expect(letterSoundKey(hear('s'))).toBeNull();
});

it('see-hear names the letter NAME as the miss; a clipped stop also accepts its keyword', () => {
  expect(letterSoundKey(see('m', 'mmm', 'map'))).toMatchObject({ answer: 'mmm', alsoAccept: [],
    signatureError: expect.stringContaining('"em"') });
  expect(letterSoundKey(see('t', '/t/', 'tent'))).toMatchObject({ answer: '/t/', alsoAccept: ['tent'],
    acceptRule: expect.stringMatching(/small "uh" after it counts/), signatureError: expect.stringContaining('"tee"') });
});

it('keyword-match names both misses: the other picture, and the letter sound said back', () => {
  const key = letterSoundKey({ id: 'k', mode: 'keyword-match', letter: 's', sound: '/s/', spoken: 'sss', keyword: 'sun',
    answer: 'sun', distractor: 'net' } as LetterSoundItem)!;
  expect(key.answer).toBe('sun');
  expect(key.signatureError).toMatch(/The other picture's word, "net", is not the answer/);
  // The live drive's false affirm: "sss" is a sound, and this mode's question names that sound on the way to the answer.
  expect(key.signatureError).toMatch(/"sss", is a sound and not the name of a picture/);
});
