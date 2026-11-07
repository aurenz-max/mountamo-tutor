/**
 * How the child answers (agent-primitive I11): the author picks `respond` by the nature of the problem; code checks it
 * fits the answer, derives the spoken key, and returns what the tutor will judge (`answeredBy`).
 */
import { describe, expect, it } from 'vitest';
import { buildStops, stopChecks, type MathScope, type StopDraft, type WordScope } from './checks';
import { MATH_MODES, modeOf, type WorldDraft } from './world';
import { WORD_MODES, readWords, wordModeOf, type ThingDraft, type WordDraft } from './words';
import { lexWord } from '../../wordSpace/lexicon';
import { wonderWalkBoss, validateWonderWalkData } from '../../../primitives/visual-primitives/core/wonder-walk/wonderWalk.boss';
import { respondOf, stopSpokenKey, stopSpokenMisses } from '../../../primitives/visual-primitives/core/wonder-walk/wonderWalkSpoken';
import { rimeOf } from '../../../primitives/visual-primitives/core/wonder-walk/wonderWalkWords';
import { stopAsk } from '../../../primitives/visual-primitives/core/wonder-walk/wonderWalkWorkspace';
import type { WonderWalkStop } from '../../../primitives/visual-primitives/core/wonder-walk/WonderWalk';

const MATH: MathScope = { max: 20, openModes: MATH_MODES };
const WORDS: WordScope = { openModes: WORD_MODES };
const p = (id: string, word: string): ThingDraft => ({ id, word });

const mathStop = (world: WorldDraft, ask: string, respond?: StopDraft['respond'], narration = 'Look closely and count with me.'): StopDraft =>
  ({ kind: modeOf(world), ideaIndex: 0, sceneWords: [], imagePrompt: '', correctWord: '', wrongWords: [], narration, ask,
    why: 'Touch each one as you count. The last number tells how many.', world, ...(respond ? { respond } : {}) });
const wordStop = (words: WordDraft, ask: string, respond?: StopDraft['respond'], narration = 'Here is a cat. Rhyming words sound the same at the end.',
  why = 'Rhyming words end the same way. Say them with cat.'): StopDraft =>
  ({ kind: wordModeOf(readWords(words).world), ideaIndex: 0, sceneWords: [], imagePrompt: '', correctWord: '', wrongWords: [], narration, ask,
    why, words, ...(respond ? { respond } : {}) });

const count7: WorldDraft = { places: [{ id: 'a', kind: 'group', arrangement: 'scattered', contents: [{ word: 'apple', count: 7 }] }], events: [], answer: { kind: 'number', countPlaces: ['a'] } };
const countOut: WorldDraft = { places: [{ id: 'pile', kind: 'pile', arrangement: 'scattered', contents: [{ word: 'apple', count: 9 }] }, { id: 'bk', kind: 'basket', arrangement: 'rows', contents: [] }],
  events: [], answer: { kind: 'move', goal: [{ places: ['bk'], count: 5 }] } };
const rhyme: WordDraft = { refs: [p('r', 'cat')], things: [p('a', 'hat'), p('b', 'dog'), p('c', 'sun')], answer: { kind: 'tap', rule: { type: 'rhymes', ref: 'r' } } };
const blend: WordDraft = { refs: [], things: [p('a', 'cat'), p('b', 'cap'), p('c', 'sun')], answer: { kind: 'tap', rule: { type: 'blend', word: 'cat', parts: 'onset-rime' } } };

const built = (d: StopDraft): WonderWalkStop => buildStops([d], ['idea'], 1, [])[0];
const checked = (d: StopDraft) => stopChecks(d, 1, d.world ? MATH : undefined, d.words ? WORDS : undefined);

describe('respond: the author picks how the child answers; code checks it fits', () => {
  it('a number answer is said by default, and the tutor judges it against the code-derived key', () => {
    const c = checked(mathStop(count7, 'How many apples are there?'));
    expect(c.blocking).toEqual([]);
    expect(c.answeredBy).toMatch(/^say: .*"7" \(also accept "seven"\)/);
    const s = built(mathStop(count7, 'How many apples are there?'));
    expect(respondOf(s)).toBe('say');
    expect(wonderWalkBoss.assignment(s)).toMatchObject({ response: 'speech', acceptsGesture: true });
  });

  it('show on an answer a child can say is blocked; say on moves is blocked; each with the fix', () => {
    expect(checked(mathStop(count7, 'How many apples are there?', 'show')).blocking.join(' ')).toMatch(/the number 7, which a child can say: respond say/);
    expect(checked(mathStop(countOut, 'Can you put five apples in the basket?', 'say', 'Look at all these apples!')).blocking.join(' '))
      .toMatch(/moves, which a child cannot say .*respond show/);
    const shown = checked(mathStop(countOut, 'Can you put five apples in the basket?', undefined, 'Look at all these apples!'));
    expect(shown.blocking).toEqual([]);
    expect(shown.answeredBy).toMatch(/^show: the activity checks it/);
  });

  it('a teen on a ten-frame is accepted as "ten and three"', () => {
    const teen: WorldDraft = { places: [{ id: 'f', kind: 'ten-frame', arrangement: 'ten-frame', contents: [{ word: 'apple', count: 13 }] }], events: [], answer: { kind: 'number', countPlaces: ['f'] } };
    const s = built(mathStop(teen, 'How many apples are on the frames?', 'say', 'The frames are full of apples!'));
    expect(stopSpokenKey(s)).toEqual({ answer: '13', alsoAccept: ['thirteen', 'ten and three'] });
  });

  it('a number stop names its spoken misses: a part of the story, then one away', () => {
    const story: WorldDraft = { places: [{ id: 'pond', kind: 'group', arrangement: 'rows', contents: [{ word: 'duck', count: 3 }] }],
      events: [{ kind: 'join', place: 'pond', word: 'duck', count: 2 }], answer: { kind: 'number', countPlaces: ['pond'] } };
    const s = built(mathStop(story, 'How many ducks are in the pond now?', 'say', 'Some ducks swim. More ducks come!'));
    expect(stopSpokenMisses(s).map(m => [m.id, m.examples])).toEqual([['said_a_part', ['three']], ['off_by_one', ['four', 'six']]]);
  });

  it('say-any: the child makes a rhyme; code finds library words that fit, none on the cards or already heard', () => {
    const d = wordStop(rhyme, 'Can you think of a word that rhymes with cat?', 'say-any');
    const c = checked(d);
    expect(c.blocking).toEqual([]);
    const s = built(d);
    expect(s.sayAny!.length).toBeGreaterThanOrEqual(3);
    const rime = rimeOf(lexWord('cat')!.phones);
    for (const w of s.sayAny!) {
      expect(rimeOf(lexWord(w)!.phones)).toBe(rime);
      expect(['cat', 'hat', 'dog', 'sun']).not.toContain(w);
    }
    const key = stopSpokenKey(s)!;
    expect(key.answer).toBe('hat');
    expect(key.acceptRule).toMatch(/Any real word that rhymes with "cat"/);
    expect(c.answeredBy).toContain('Any real word that rhymes with "cat"');
    expect(() => validateWonderWalkData({ title: 't', bigIdea: 'b', domain: 'language', gradeBand: 'K', challengeType: 'rhyme',
      challenges: [s, { ...s, id: 'stop-2' }] })).not.toThrow();
  });

  it('say-any needs a rule with many right words; a blend has one', () => {
    expect(checked(wordStop(blend, 'Listen, [sounds], which picture is it?', 'say-any', 'Listen to the sounds.', 'Say the sounds fast to make a word.')).blocking.join(' '))
      .toMatch(/say-any needs a rule with many right words/);
    const said = checked(wordStop(blend, 'Listen, [sounds], which picture is it?', 'say', 'Listen to the sounds.', 'Say the sounds fast to make a word.'));
    expect(said.blocking).toEqual([]);
    expect(said.answeredBy).toContain('"cat"');
  });

  it('a sort in a sayable mode is shown: no key, a gesture item', () => {
    const sort: WordDraft = { refs: [p('r1', 'cat'), p('r2', 'sun')], things: [p('a', 'hat'), p('b', 'rat'), p('c', 'bun')],
      answer: { kind: 'sort', baskets: [{ id: 'k1', label: 'r1', rule: { type: 'rhymes', ref: 'r1' } }, { id: 'k2', label: 'r2', rule: { type: 'rhymes', ref: 'r2' } }] } };
    const s = built(wordStop(sort, 'Can you put each picture with the word it rhymes with?', undefined, 'Here is a cat and here is the sun.'));
    expect(respondOf(s)).toBe('show');
    expect(stopSpokenKey(s)).toBeNull();
    expect(wonderWalkBoss.assignment(s)).toEqual({ id: s.id, task: stopAsk(s), response: 'gesture' });
  });

  it('validate refuses a stored say-any stop with no examples, and a respond that does not fit', () => {
    const s = built(wordStop(rhyme, 'Can you think of a word that rhymes with cat?', 'say-any'));
    const walk = (x: WonderWalkStop) => ({ title: 't', bigIdea: 'b', domain: 'language', gradeBand: 'K', challengeType: 'rhyme', challenges: [x, { ...x, id: 'stop-2' }] });
    expect(() => validateWonderWalkData(walk({ ...s, sayAny: [] }))).toThrow(/at least 3 other library words/);
    expect(() => validateWonderWalkData(walk({ ...s, respond: 'show' }))).toThrow(/a word, which a child can say/);
  });
});
