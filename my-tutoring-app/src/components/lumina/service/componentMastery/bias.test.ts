import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withGenerationRequest } from '../generation/generationRequest';
import { openLearningObservations, signLearningObservations } from '../generation/learningObservationPacket';
import { TEST_SIGNING_KEY, packetFixture } from '../generation/learningObservationPacket.fixtures';
import { mulberry32, tierPick, type WordSpaceItem } from '../wordSpace/pick';
import { weakLetterSoundScorer } from './bias';
import { unitPairs } from './registry';

const signed = (components: unknown, key = TEST_SIGNING_KEY) =>
  signLearningObservations({ ...packetFixture([], []), components } as never, key);
const within = <T,>(components: unknown, run: () => T, key?: string) =>
  withGenerationRequest({ authorization: null, learningObservations: signed(components, key) }, run);

beforeEach(() => { vi.stubEnv('LUMINA_GENERATION_SIGNING_KEY', TEST_SIGNING_KEY); });
afterEach(() => { vi.unstubAllEnvs(); });

// Twelve one-structure CVC words; three have short e.
const WORDS = ['cat', 'sat', 'map', 'pin', 'sit', 'dog', 'hot', 'sun', 'cup', 'bed', 'pet', 'hen'];
const space: WordSpaceItem<string>[] = WORDS.map(w => ({ beta: 0, structure: 'cvc', words: [w], reads: [w], payload: w }));
const draw = () => tierPick(space, 'easy', 3, mulberry32(7)).map(it => it.payload);
const E = 'e/EH', U = 'u/AH', E_WORDS = ['bed', 'pet', 'hen'];
/** Every pair of the twelve words read twice, both right: nothing weak, nothing left to cover. */
const allRead = (): Record<string, [number, number]> =>
  Object.fromEntries(WORDS.flatMap(w => unitPairs(w)).map(id => [id, [2, 2]]));

describe('weak letter-sound scorer', () => {
  it('is absent with no packet, with no weak pair, and with a packet signed by another key', () => {
    expect(weakLetterSoundScorer()).toBeNull();
    expect(within({ letter_sound: { 'e/EH': [5, 5], 'a/AE': [1, 0] } }, weakLetterSoundScorer)).toBeNull();
    expect(within({ letter_sound: { 'e/EH': [4, 1] } }, weakLetterSoundScorer, 'another-key-of-at-least-thirty-two-chars')).toBeNull();
  });

  it('scores a word by its weakest weak pair, and a letter card by its taught pair', () => {
    const score = within({ letter_sound: { 'e/EH': [4, 1], 'd/D': [5, 3] } }, weakLetterSoundScorer)!;
    expect(score(['bed'])).toBe(0.75);
    expect(score(['dog'])).toBeCloseTo(0.4);
    expect(score(['cat'])).toBe(0);
    expect(score(['letter:e'])).toBe(0.75);
  });

  it('a malformed packet row is dropped when the packet is opened', () => {
    const packet = openLearningObservations(signed({ letter_sound: { 'e/EH': [1, 2], 'a/AE': [3, 1], 'x/K S': 'no' }, 'Bad': {} }), TEST_SIGNING_KEY);
    expect(packet?.components).toEqual({ letter_sound: { 'a/AE': [3, 1] } });
  });
});

describe('tierPick with tallies', () => {
  it('draws the weak pair for at most half the session (rounded up) and leaves the draw unchanged without tallies', () => {
    const plain = draw();
    const weakE = within({ letter_sound: { 'e/EH': [4, 1] } }, draw);
    expect(weakE.filter(w => ['bed', 'pet', 'hen'].includes(w))).toHaveLength(2);
    expect(within({ letter_sound: allRead() }, draw)).toEqual(plain);
  });

  it('every session reads a pair the learner has not read, and one such word is enough', () => {
    const { [E]: _unread, ...rest } = allRead();
    let plain = 0, leaned = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const eWords = (run: () => WordSpaceItem<string>[]) => run().filter(it => E_WORDS.includes(it.payload)).length;
      const got = eWords(() => within({ letter_sound: rest }, () => tierPick(space, 'easy', 3, mulberry32(seed))));
      expect(got).toBeGreaterThan(0);
      leaned += got;
      plain += eWords(() => tierPick(space, 'easy', 3, mulberry32(seed)));
    }
    // 20 sessions of 3 from 12 words, 3 of them with e: about 15 by chance; the lean adds the sessions chance missed.
    expect(leaned).toBeLessThan(plain + 20);
    expect(leaned).toBeGreaterThan(plain);
  });

  it('a weak pair comes before an unread pair, and the unread pair takes the slot after the cap', () => {
    const { [U]: _unread, ...rest } = allRead();
    const picks = within({ letter_sound: { ...rest, [E]: [4, 1] } }, draw);
    expect(picks.filter(w => E_WORDS.includes(w))).toHaveLength(2);
    expect(picks.filter(w => ['sun', 'cup'].includes(w))).toHaveLength(1);
  });

  it('an unread pair never moves the draw out of the requested tier', () => {
    const { [E]: _unread, ...rest } = allRead();
    const tiered = space.map((it, i) => ({ ...it, beta: i < 9 ? 0 : 2 }));
    const easy = within({ letter_sound: rest }, () => tierPick(tiered, 'easy', 3, mulberry32(3)));
    expect(easy.every(it => it.beta === 0)).toBe(true);
  });

  it('a weak item tied in beta across a tier boundary joins the band asked for, whichever side it was shuffled to', () => {
    // Nine items at beta 1 straddle the easy and medium thirds; only 'pet' is weak.
    const tied = space.map((it, i) => ({ ...it, beta: i < 3 ? 0 : i < 12 ? 1 : 2, structure: it.payload }));
    for (const tier of ['easy', 'medium'] as const) for (let seed = 1; seed <= 20; seed++) {
      const picks = within({ letter_sound: { 'e/EH': [4, 0] } }, () => tierPick(tied, tier, 3, mulberry32(seed))).map(it => it.payload);
      expect(picks.filter(w => ['bed', 'pet', 'hen'].includes(w)).length).toBeGreaterThan(0);
    }
  });

  it('a spelling item leans on the spelling tallies only, and a reading item on the letter-sound tallies only', () => {
    const spell: WordSpaceItem<string>[] = WORDS.map(w => ({ beta: 0, structure: 'cvc', words: [w], spells: [w], payload: w }));
    const drawSpell = () => tierPick(spell, 'easy', 3, mulberry32(7)).map(it => it.payload);
    const eWords = (picks: string[]) => picks.filter(w => ['bed', 'pet', 'hen'].includes(w)).length;
    expect(eWords(within({ spelling: { 'e/EH': [4, 1] } }, drawSpell))).toBe(2);
    expect(within({ letter_sound: { 'e/EH': [4, 1] } }, drawSpell)).toEqual(drawSpell());
    expect(within({ spelling: { 'e/EH': [4, 1] } }, draw)).toEqual(draw());
  });

  it('never leaves the requested tier for a weak item', () => {
    const tiered = space.map((it, i) => ({ ...it, beta: i < 9 ? 0 : 2 }));  // the e words are the hardest third
    const easy = within({ letter_sound: { 'e/EH': [4, 0] } }, () => tierPick(tiered, 'easy', 3, mulberry32(3)));
    expect(easy.every(it => it.beta === 0)).toBe(true);
  });
});
