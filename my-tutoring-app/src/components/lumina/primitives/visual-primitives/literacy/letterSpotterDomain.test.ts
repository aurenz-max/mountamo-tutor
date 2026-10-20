/**
 * Letter spotter's domain: the build gates, the one-letter-answered-once session rule, what each ask may say, the
 * spoken key, and the taps' named misses. Moved from the retired DI-script suite (its cue, correction and tier-ladder
 * assertions went with the script) and the old workspace miss test.
 */
import { describe, expect, it } from 'vitest';
import { askLeaks, spokenKeyText } from '../../../components/live-activity/spokenKey';
import {
  askFor, askGiven, itemFromChallenge, itemsFromChallenges, letterSpotterKey, letterSpotterMiss, letterSpotterScene,
  SPOTTER_EMOJI, type LetterSpotterItem, type LetterSpotterTier,
} from './letterSpotterDomain';

const SPOT_RAW = { id: 'lsp-1', mode: 'name-it' as const, targetLetter: 'a', targetWord: 'ant',
  spokenSentence: 'I see an ant walk away.', sentence: `I see an ${SPOTTER_EMOJI}nt walk away.`, options: ['a', 's', 't', 'n'] };
const SPOT_N_RAW = { id: 'lsp-4', mode: 'name-it' as const, targetLetter: 'n', targetWord: 'net',
  spokenSentence: 'I can see the net.', sentence: `I can see the ${SPOTTER_EMOJI}et.` };
const FIND_RAW = { id: 'lsp-2', mode: 'find-it' as const, targetLetter: 'p', letterGrid: 'SATINPSATINSATIN'.split('') };
const MATCH_RAW = { id: 'lsp-3', mode: 'match-it' as const, targetLetter: 's', options: ['s', 'a', 'n', 't'] };
const TIERS: LetterSpotterTier[] = ['easy', 'medium', 'hard'];
const build = (ch: Parameters<typeof itemFromChallenge>[0], tier: LetterSpotterTier = 'medium') => itemFromChallenge(ch, tier)!;
/** Names a letter the way a tutor says one: an isolated capital, or "letter x". */
const namesLetter = (text: string, letter: string) =>
  new RegExp(`\\b${letter.toUpperCase()}\\b`).test(text) || new RegExp(`\\bletter ${letter}\\b`, 'i').test(text);

describe('build gates', () => {
  it('drops a name-it word that does not lead with the target letter', () => {
    expect(itemFromChallenge({ ...SPOT_RAW, targetLetter: 'x' })).toBeNull();
  });

  it('drops model babble, an underscored sentence and a sentence too long for one breath', () => {
    const babble = 'sheep-invalid-word-fix-start-with-s-no-dash-sheep-is-fine-wait-sheep';
    expect(itemFromChallenge({ ...SPOT_RAW, targetLetter: 's', targetWord: babble, spokenSentence: `I can see the ${babble}.`,
      sentence: `I can see the ${SPOTTER_EMOJI}${babble.slice(1)}.` })).toBeNull();
    expect(itemFromChallenge({ ...SPOT_RAW, spokenSentence: 'I can see the ant_is_a_farm_word_yes_ant_is_fine_use_ant.' })).toBeNull();
    expect(itemFromChallenge({ ...SPOT_RAW, spokenSentence: `I see an ant ${'walking slowly around the barn '.repeat(5)}.` })).toBeNull();
  });

  it('drops a word whose first LETTER does not spell its first SOUND; blends survive', () => {
    for (const [letter, word] of [['s', 'sheep'], ['c', 'chair'], ['t', 'think'], ['p', 'phone'], ['k', 'knee'], ['w', 'write']] as const)
      expect(itemFromChallenge({ ...SPOT_RAW, targetLetter: letter, targetWord: word, spokenSentence: `Look at the ${word}.`,
        sentence: `Look at the ${SPOTTER_EMOJI}${word.slice(1)}.` })).toBeNull();
    for (const [letter, word] of [['g', 'grass'], ['s', 'stop']] as const)
      expect(itemFromChallenge({ ...SPOT_RAW, targetLetter: letter, targetWord: word, spokenSentence: `Look at the ${word}.`,
        sentence: `Look at the ${SPOTTER_EMOJI}${word.slice(1)}.` })).not.toBeNull();
  });

  it('drops a sentence holding the word twice, or opening with a verdict sentinel', () => {
    expect(itemFromChallenge({ ...SPOT_RAW, spokenSentence: 'I see an ant and another ant.' })).toBeNull();
    expect(itemFromChallenge({ ...SPOT_RAW, spokenSentence: 'Yes, I see an ant walk away.' })).toBeNull();
  });

  it('name-it carries no options: a menu would make it recognition', () => {
    expect(build(SPOT_RAW).options).toEqual([]);
    expect(build({ ...SPOT_RAW, options: undefined })).not.toBeNull();
  });

  it('drops a find-it grid unless it holds exactly one target, and a match-it without answer or distractor', () => {
    const twice = [...FIND_RAW.letterGrid]; twice[0] = 'P';
    expect(itemFromChallenge({ ...FIND_RAW, letterGrid: twice })).toBeNull();
    expect(itemFromChallenge({ ...FIND_RAW, letterGrid: FIND_RAW.letterGrid.map(c => (c === 'P' ? 'S' : c)) })).toBeNull();
    expect(itemFromChallenge(FIND_RAW)).not.toBeNull();
    expect(itemFromChallenge({ ...MATCH_RAW, options: ['a', 'n', 't'] })).toBeNull();
    expect(itemFromChallenge({ ...MATCH_RAW, options: ['s'] })).toBeNull();
  });
});

describe('one letter, answered once', () => {
  it('drops a name-it item whose letter an earlier find-it named, and a second item on an answered letter', () => {
    expect(itemsFromChallenges([FIND_RAW, { ...SPOT_RAW, id: 'lsp-p', targetLetter: 'p', targetWord: 'pan',
      spokenSentence: 'Look at the pan.', sentence: `Look at the ${SPOTTER_EMOJI}an.` }, MATCH_RAW]).map(i => i.id)).toEqual(['lsp-2', 'lsp-3']);
    expect(itemsFromChallenges([SPOT_RAW, { ...SPOT_RAW, id: 'lsp-a2', targetWord: 'apple', spokenSentence: 'Look at the apple.',
      sentence: `Look at the ${SPOTTER_EMOJI}pple.` }, { ...MATCH_RAW, id: 'lsp-am', targetLetter: 'a' }]).map(i => i.id)).toEqual(['lsp-1']);
  });

  it('lets find-it repeat a letter, and keeps a session of distinct letters whole', () => {
    expect(itemsFromChallenges([FIND_RAW, { ...FIND_RAW, id: 'b' }, { ...FIND_RAW, id: 'c' }])).toHaveLength(3);
    expect(itemsFromChallenges([SPOT_RAW, FIND_RAW, MATCH_RAW, SPOT_N_RAW])).toHaveLength(4);
  });
});

describe('what the ask may say', () => {
  it('name-it says the word and never the letter; easy says the word alone too', () => {
    for (const tier of TIERS) {
      const ask = askFor(build(SPOT_N_RAW, tier));
      expect(ask).toContain('net');
      expect(namesLetter(ask, 'n')).toBe(false);
    }
    expect(askFor(build(SPOT_N_RAW, 'easy'))).toContain('The word is net.');
  });

  it('find-it names the letter (its stimulus); match-it names neither case', () => {
    expect(askFor(build(FIND_RAW))).toContain('letter P');
    expect(namesLetter(askFor(build(MATCH_RAW)), 's')).toBe(false);
  });

  it('no ask or scene describes what a letter looks like', () => {
    const SHAPE = ['curvy', 'curve', 'snake', 'triangle', 'circle', 'stick', 'line across', 'dot on top', 'hump', 'tail', 'looks like a'];
    for (const raw of [SPOT_RAW, SPOT_N_RAW, FIND_RAW, MATCH_RAW]) {
      const text = `${askFor(build(raw))} ${letterSpotterScene(build(raw)).facts.shown}`.toLowerCase();
      for (const word of SHAPE) expect(text).not.toContain(word);
    }
  });
});

describe('the spoken key', () => {
  it('accepts the letter or its sound, names the word said back, and only name-it has one', () => {
    const key = letterSpotterKey(build(SPOT_N_RAW))!;
    expect(key).toMatchObject({ answer: 'N', alsoAccept: ['/n/'] });
    expect(spokenKeyText(key)).toMatch(/"net" said back is not a letter/);
    expect(letterSpotterKey(build({ ...SPOT_RAW, targetLetter: 'c', targetWord: 'cat', spokenSentence: 'The cat naps.',
      sentence: `The ${SPOTTER_EMOJI}at naps.` }))!.alsoAccept).toEqual(['/k/']);
    expect(letterSpotterKey(build(FIND_RAW))).toBeNull();
    expect(letterSpotterKey(build(MATCH_RAW))).toBeNull();
  });

  it('the ask never says the answer: the sentence is given only where the letter is ordinary English', () => {
    const check = (item: LetterSpotterItem) => askLeaks(askFor(item), letterSpotterKey(item)!, askGiven(item));
    expect(check(build(SPOT_RAW))).toEqual([]);
    expect(check(build({ ...SPOT_RAW, spokenSentence: 'Look at a big ant.' }))).toEqual([]);
    expect(check(build({ ...SPOT_RAW, id: 's', targetLetter: 's', targetWord: 'sun', spokenSentence: "It's a sunny sun day." }))).toEqual([]);
    // A sentence that says the letter on its own any other way is a leak.
    expect(check(build({ ...SPOT_RAW, id: 's', targetLetter: 's', targetWord: 'sun', spokenSentence: 'S is for sun.' }))).not.toEqual([]);
  });
});

describe('a checked wrong tap names its miss', () => {
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
});
