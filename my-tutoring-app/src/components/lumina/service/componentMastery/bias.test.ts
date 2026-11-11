import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withGenerationRequest } from '../generation/generationRequest';
import { openLearningObservations, signLearningObservations } from '../generation/learningObservationPacket';
import { TEST_SIGNING_KEY, packetFixture } from '../generation/learningObservationPacket.fixtures';
import { mulberry32, tierPick, type WordSpaceItem } from '../wordSpace/pick';
import { weakLetterSoundScorer } from './bias';

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
    expect(within({ letter_sound: { 'e/EH': [4, 4] } }, draw)).toEqual(plain);
  });

  it('a weak item tied in beta across a tier boundary joins the band asked for, whichever side it was shuffled to', () => {
    // Nine items at beta 1 straddle the easy and medium thirds; only 'pet' is weak.
    const tied = space.map((it, i) => ({ ...it, beta: i < 3 ? 0 : i < 12 ? 1 : 2, structure: it.payload }));
    for (const tier of ['easy', 'medium'] as const) for (let seed = 1; seed <= 20; seed++) {
      const picks = within({ letter_sound: { 'e/EH': [4, 0] } }, () => tierPick(tied, tier, 3, mulberry32(seed))).map(it => it.payload);
      expect(picks.filter(w => ['bed', 'pet', 'hen'].includes(w)).length).toBeGreaterThan(0);
    }
  });

  it('never leaves the requested tier for a weak item', () => {
    const tiered = space.map((it, i) => ({ ...it, beta: i < 9 ? 0 : 2 }));  // the e words are the hardest third
    const easy = within({ letter_sound: { 'e/EH': [4, 0] } }, () => tierPick(tiered, 'easy', 3, mulberry32(3)));
    expect(easy.every(it => it.beta === 0)).toBe(true);
  });
});
