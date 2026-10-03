/**
 * The hear-see levers' leak rules, the practice-pair builder, and "this wrong tap, then this lever"
 * (`/add-support-tiers`, handoff 22 L1).
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { LETTER_GROUPS } from '../../../service/literacy/letterGroups';
import { itemFromChallenge, letterSoundMiss, type LetterSoundItem } from './letterSoundLinkDomain';
import { LITERACY_CATALOG } from '../../../service/manifest/catalog/literacy';
import {
  cardKeywords, cardKeywordsLeak, fartherPair, laterStimuli, letterModelFor, letterModelLeak, letterSoundLevers, practiceLeak, voiceModelFor,
} from './letterSoundLinkLevers';

const hear = (id: string, target: string, foil: string): LetterSoundItem => itemFromChallenge({ id, mode: 'hear-see',
  targetLetter: target, targetSound: `/${target}/`, keywordWord: '', options: [{ letter: target, isCorrect: true }, { letter: foil, isCorrect: false }] });
const see = (id: string, letter: string) => itemFromChallenge({ id, mode: 'see-hear', targetLetter: letter, targetSound: `/${letter}/`, keywordWord: '' });

describe('keyword pictures under both cards', () => {
  it('both cards or neither, each its own picture', () => {
    const item = hear('h', 'a', 'e');
    const drawn = cardKeywords(item, new Set());
    expect(drawn.map(k => [k.letter, k.word])).toEqual([['a', 'apple'], ['e', 'egg']]);
    expect(cardKeywordsLeak(item, drawn)).toBe(false);
    expect(cardKeywordsLeak(item, drawn.slice(0, 1))).toBe(true);
  });

  it('none when a picture does not read as its word (itch for i)', () => {
    expect(cardKeywords(hear('h', 'a', 'i'), new Set())).toEqual([]);
  });

  it('none when a later item asks or shows either letter or keyword (R4)', () => {
    const items = [hear('h1', 's', 'f'), see('s2', 'f')];
    expect(cardKeywords(items[0], laterStimuli(items, 0))).toEqual([]);
    expect(cardKeywords(items[0], laterStimuli([items[0], see('s2', 'm')], 0))).toHaveLength(2);
  });
});

describe('the voicing model', () => {
  it.each([['t', 'd'], ['p', 'b'], ['s', 'z'], ['f', 'v'], ['k', 'g']])('%s/%s: pictures of a pair that is not the item\'s', (a, b) => {
    const model = voiceModelFor(hear('h', a, b))!;
    expect(model.pair).not.toContain(a);
    expect(model.pair).not.toContain(b);
    expect(model.quiet.sound).not.toBe(model.buzz.sound);
  });

  it('only on a voicing pair', () => {
    expect(voiceModelFor(hear('h', 's', 'f'))).toBeNull();
  });
});

describe('the practice pair', () => {
  const LETTERS = ['m', 's', 'f', 'n', 'l', 'r', 't', 'p', 'd', 'b', 'a', 'o', 'u', 'e'];
  it.each([1, 2, 3, 4])('group %i: a new sound against the other kind, sharing no session letter', group => {
    const inGroup = LETTERS.filter(l => LETTER_GROUPS[group].includes(l));
    for (let i = 0; i + 3 < inGroup.length; i++) {
      const items = [hear('h1', inGroup[i], inGroup[i + 1]), hear('h2', inGroup[i + 2], inGroup[i + 3])];
      const practice = fartherPair(items[0], items, group);
      if (!practice) continue;
      expect(practice.id).toBe('h1~simpler');
      expect(practice.mode).toBe('hear-see');
      expect(practiceLeak(practice, items)).toBe(false);
      const [x, y] = practice.options.map(o => o.value);
      expect('aeiou'.includes(x)).not.toBe('aeiou'.includes(y));
      expect(practice.options.filter(o => o.isCorrect).map(o => o.value)).toEqual([practice.answer]);
      expect(practice.options.every(o => LETTER_GROUPS[group].includes(o.value))).toBe(true);
    }
  });

  it('a typical group-3 session gets m against a', () => {
    const items = [hear('h1', 's', 'f'), hear('h2', 'd', 't')];
    expect(fartherPair(items[0], items, 3)).toMatchObject({ letter: 'm', answer: 'm', distractor: 'a' });
  });
});

describe('levers and the miss they answer', () => {
  const items = [hear('h1', 's', 'f'), hear('h2', 'd', 't'), hear('h3', 'a', 'e')];
  it.each([
    [0, 'f', 'other_letter', 'keyword_under_both'],
    [1, 't', 'voicing_partner', 'voice_feel_model'],
    [2, 'e', 'other_short_vowel', 'keyword_under_both'],
  ])('item %i, tapped %s: the miss is %s and the next lever %s', (index, tapped, miss, lever) => {
    const item = items[index];
    expect(letterSoundMiss(item, tapped)).toBe(miss);
    expect(nextLever(letterSoundLevers(item, [], items, index, 3), miss)).toBe(lever);
  });

  it('with the help pulled, the practice pair is next', () => {
    expect(nextLever(letterSoundLevers(items[1], ['voice_feel_model'], items, 1, 3), 'voicing_partner')).toBe('far_letter_pair');
  });

  it('the spoken modes declare letter_model only', () => {
    expect(letterSoundLevers(see('s', 'm'), [], [see('s', 'm')], 0, 3).map(l => [l.id, l.kind, l.carrier]))
      .toEqual([['letter_model', 'help', 'both']]);
  });
});

describe('letter_model (handoff 24)', () => {
  const match = (id: string, letter: string, foil: string) => itemFromChallenge({ id, mode: 'keyword-match', targetLetter: letter,
    targetSound: `/${letter}/`, keywordWord: '', options: [{ sound: 'x', isCorrect: true }, { sound: foil, isCorrect: false }] });

  it.each([1, 2, 3, 4])('group %i: the model is never a session letter, keyword or picture, and keeps the sound kind', group => {
    const session = ['s', 'm', 't', 'a'].filter(l => LETTER_GROUPS[group].includes(l)).map((l, i) => see(`s${i}`, l));
    for (const item of session) {
      const m = letterModelFor(item, session, group)!;
      expect(m).toBeTruthy();
      expect(letterModelLeak(m, session)).toBe(false);
      const kind = (l: string) => 'aeiou'.includes(l) ? 'v' : 'tpckhdgb'.includes(l) ? 'c' : 'h';
      expect(kind(m.letter)).toBe(kind(item.letter));
    }
  });

  it('keyword-match: the model is not the item keyword or foil picture', () => {
    const session = [match('k1', 's', 'net'), match('k2', 'p', 'hat')];
    const m = letterModelFor(session[0], session, 4)!;
    expect(['s', 'p']).not.toContain(m.letter);
    expect(['sun', 'net', 'pig', 'hat']).not.toContain(m.word);
  });

  it.each([
    ['see', 'letter_name'], ['see', 'keyword_word'], ['see', 'added_vowel'],
    ['match', 'other_picture'], ['match', 'letter_name'], ['match', 'said_the_sound'],
  ])('%s: %s -> letter_model', (kind, miss) => {
    const item = kind === 'see' ? see('s1', 's') : match('k1', 's', 'net');
    expect(nextLever(letterSoundLevers(item, [], [item], 0, 4), miss)).toBe('letter_model');
  });

  it('every spoken miss is answered or unanswered by decision (J9)', () => {
    const entry = LITERACY_CATALOG.find(c => c.id === 'letter-sound-link')!.teachingWorkspace!;
    expect(entry.levers).toBe(true);
    for (const [mode, item] of [['see_hear', see('s1', 's')], ['keyword_match', match('k1', 's', 'net')]] as const) {
      const answered = letterSoundLevers(item, [], [item], 0, 4).flatMap(l => l.answers ?? []);
      expect([...answered, ...(entry.unanswered?.[mode] ?? [])].sort()).toEqual([...entry.misses![mode]].sort());
    }
  });
});

it('letter_model: its description names no model letter or word (read before the pull)', () => {
  const item = see('s1', 's');
  const m = letterModelFor(item, [item], 4)!;
  const [lever] = letterSoundLevers(item, [], [item], 0, 4);
  expect(lever.does).not.toMatch(new RegExp(`\\b(${m.letter}|${m.word}|${m.sound})\\b`, 'i'));
});
