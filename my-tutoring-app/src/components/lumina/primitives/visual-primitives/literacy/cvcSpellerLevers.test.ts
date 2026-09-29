/**
 * The CVC spelling levers' leak rules, the practice-word builder, and "this wrong spelling, then this
 * lever" (`/add-support-tiers`, handoff 22 L1). Code, so none of it is a question for a Live run.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { cvcUsableLetters, isCvcSpelling, type LetterGroup } from '../../../service/literacy/letterGroups';
import type { CvcSpellerChallenge } from './CvcSpeller';
import { cvcMiss, cvcScene } from './cvcSpellerWorkspace';
import { LITERACY_CATALOG } from '../../../service/manifest/catalog/literacy';
import {
  PRACTICE_WORDS, cvcLevers, middleModelFor, middleModelLeak, modelMiddleSaid, keywordFor, keywordsLeak, practiceLeak, sessionStimuli, smallerWord, vowelStrip, vowelStripLeak,
} from './cvcSpellerLevers';

const spell = (word: string, emoji = '🐱', id = word): CvcSpellerChallenge => ({ id, taskType: 'spell-word', targetWord: word,
  targetLetters: word.split(''), targetPhonemes: [], emoji, imageDescription: word, distractorLetters: [] });
const GROUPS: LetterGroup[] = [1, 2, 3, 4];
const ALL = 'abcdefghijklmnopqrstuvwxyz'.split('').filter(l => l !== 'q');

describe('keyword pictures never picture a session word', () => {
  it('falls back past a keyword that is the item: c on a "cat" item is a car', () => {
    expect(keywordFor('c', sessionStimuli([spell('cat')]))).toEqual({ word: 'car', emoji: '🚗' });
    expect(keywordFor('c', sessionStimuli([spell('dog', '🐶')]))).toEqual({ word: 'cat', emoji: '🐱' });
  });

  it.each(PRACTICE_WORDS.map(p => [p.word, p.emoji]))('a "%s" session: no drawn keyword pictures it', (word, emoji) => {
    const s = sessionStimuli([spell(word, emoji)]);
    const drawn = ALL.map(l => keywordFor(l, s)).filter((k): k is NonNullable<typeof k> => !!k);
    expect(keywordsLeak(drawn, s)).toBe(false);
  });
});

describe('the vowel strip', () => {
  it.each(GROUPS)('group %i: at least two vowels, the item\'s own among them, none marked', group => {
    const item = spell(group === 1 ? 'pin' : 'pet');
    const strip = vowelStrip(item, group, sessionStimuli([item]));
    expect(vowelStripLeak(strip)).toBe(false);
    expect(strip.map(v => v.letter)).toContain(item.targetWord[1]);
    expect(Object.keys(strip[0]).sort()).toEqual(['emoji', 'letter', 'word']);
  });

  it('one vowel alone would mark the answer', () => {
    expect(vowelStripLeak([{ letter: 'a' }])).toBe(true);
  });
});

describe('the practice word', () => {
  const items = PRACTICE_WORDS.map(p => spell(p.word, p.emoji));
  it.each(GROUPS)('group %i: every practice word is a new in-group CVC word with a four-letter bank', group => {
    const usable = cvcUsableLetters(group);
    for (const item of items.filter(i => i.targetLetters.every(l => usable.includes(l)))) {
      const s = sessionStimuli([item, spell('sip', '🥤', 'x')]);
      const simpler = smallerWord(item, group, s);
      if (!simpler) continue;
      expect(isCvcSpelling(simpler.targetWord)).toBe(true);
      expect(simpler.targetLetters).toEqual(simpler.targetWord.split(''));
      expect(simpler.targetLetters.every(l => usable.includes(l))).toBe(true);
      expect(practiceLeak(simpler.targetWord, item, s)).toBe(false);
      expect(s.emojis).not.toContain(simpler.emoji);
      expect(simpler.id).not.toBe(item.id);
      expect(simpler.taskType).toBe('spell-word');
      const bank = new Set([...simpler.targetLetters, ...simpler.distractorLetters]);
      expect(bank.size).toBe(4);
      expect('aeiou').not.toContain(simpler.distractorLetters[0]);
    }
  });

  it('never a session word, its rime, or two boxes shared with the item', () => {
    const s = sessionStimuli([spell('cat'), spell('pin', '📌')]);
    expect(practiceLeak('cat', spell('cat'), s)).toBe(true);
    expect(practiceLeak('hat', spell('cat'), s)).toBe(true);
    expect(practiceLeak('cap', spell('cat'), s)).toBe(true);
    expect(practiceLeak('map', spell('cat'), s)).toBe(false);
  });

  it.each(['short-a', 'short-e', 'short-i', 'short-o', 'short-u'])('%s: the practice word keeps the named vowel', focus => {
    const item = spell('dig', '⛏️');
    const simpler = smallerWord(item, 4, sessionStimuli([item]), focus);
    expect(simpler?.targetWord[1]).toBe(focus.slice(-1));
  });

  it('is found for a typical group-2 item', () => {
    const item = spell('cat');
    expect(smallerWord(item, 2, sessionStimuli([item]))).toMatchObject({ targetWord: 'map', distractorLetters: ['s'], practiceBank: true });
  });
});

describe('levers and the miss they answer', () => {
  const item = spell('cat');
  const s = sessionStimuli([item]);
  const levers = cvcLevers(item, [], 2, s, ['c', 'a', 't', 'm', 'e']);

  it('declares four levers on a spelling and only middle_model on the spoken modes', () => {
    expect(levers.map(l => [l.id, l.kind, l.carrier])).toEqual([
      ['vowel_keywords', 'help', 'shown'], ['consonant_keywords', 'help', 'shown'],
      ['sound_tokens', 'help', 'shown'], ['small_word', 'simplify', 'shown']]);
    expect(cvcLevers({ ...item, taskType: 'fill-vowel' }, [], 2, s, []).map(l => [l.id, l.kind, l.carrier]))
      .toEqual([['middle_model', 'help', 'both']]);
    expect(JSON.stringify(levers)).not.toMatch(/\bcat\b|"c a t"/);
  });

  it.each([
    ['cet', 'middle_letter', 'vowel_keywords'],
    ['mat', 'first_letter', 'consonant_keywords'],
    ['cam', 'last_letter', 'consonant_keywords'],
    ['tac', 'letters_out_of_order', 'sound_tokens'],
    ['met', 'two_or_more_letters', 'sound_tokens'],
  ])('%s: the miss is %s and the next lever %s', (built, miss, lever) => {
    expect(cvcMiss(item, built.split(''))).toBe(miss);
    expect(nextLever(levers, miss)).toBe(lever);
  });

  it('two or more wrong with the tokens already pulled: the practice word', () => {
    expect(nextLever(cvcLevers(item, ['sound_tokens'], 2, s, ['c', 'a', 't', 'm', 'e']), 'two_or_more_letters')).toBe('small_word');
  });

  it('every spell_word miss is answered by a lever', () => {
    const answered = new Set(levers.flatMap(l => l.answers ?? []));
    for (const miss of ['first_letter', 'middle_letter', 'last_letter', 'letters_out_of_order', 'two_or_more_letters']) {
      expect(answered.has(miss)).toBe(true);
    }
  });
});

describe('middle_model on the spoken modes (handoff 24)', () => {
  const say = (word: string, emoji = '⭐', taskType: CvcSpellerChallenge['taskType'] = 'fill-vowel'): CvcSpellerChallenge =>
    ({ ...spell(word, emoji), taskType });
  const oneVowel = ['cat', 'map', 'bag'].map(w => say(w));
  const everyVowel = ['cat', 'bed', 'pig', 'dog', 'sun'].map(w => say(w));

  it.each([['one vowel asked', oneVowel], ['every short vowel asked', everyVowel]])('%s: the model passes its leak rule', (_l, items) => {
    const s = sessionStimuli(items);
    for (const item of items) {
      const model = middleModelFor(item, s)!;
      expect(model).toBeTruthy();
      expect(middleModelLeak(model, s)).toBe(false);
      expect(s.words).not.toContain(model.word);
    }
  });

  it('every short vowel asked: the model is a long-vowel word, said by its name', () => {
    const model = middleModelFor(everyVowel[0], sessionStimuli(everyVowel))!;
    expect(['ay', 'ee', 'oh']).toContain(modelMiddleSaid(model));
    expect(cvcScene(everyVowel[0], { boxes: [], model: { word: model.word, said: modelMiddleSaid(model) } }).facts.levers_on_screen)
      .not.toMatch(/\b(ah|eh|ih|aw|uh)\b/);
  });

  it.each(['whole_word', 'first_sound', 'last_sound', 'letter_name'])('%s: the next lever is middle_model', miss => {
    for (const taskType of ['fill-vowel', 'word-sort'] as const) {
      const item = say('cat', '🐱', taskType);
      expect(nextLever(cvcLevers(item, [], 2, sessionStimuli([item]), []), miss)).toBe('middle_model');
    }
  });

  it('every spoken miss is answered or unanswered by decision (J9)', () => {
    const entry = LITERACY_CATALOG.find(c => c.id === 'cvc-speller')!.teachingWorkspace!;
    expect(entry.levers).toBe(true);
    const item = say('cat');
    const answered = cvcLevers(item, [], 2, sessionStimuli([item]), []).flatMap(l => l.answers ?? []);
    for (const mode of ['fill_vowel', 'word_sort']) {
      expect([...answered, ...entry.unanswered![mode]].sort()).toEqual([...entry.misses![mode]].sort());
    }
  });
});
