/**
 * `look_again`: the one help lever that reads WHERE a printed word was misread (lever bench LB-22, 2026-11-11).
 * A learner who reads "cat" as "cap" gets a ring on the last letter, not a dot under every letter. The place comes
 * from the miss the check named (`first_sound_changed`, `middle_sound_changed`, `last_sound_changed`), so it is
 * offered only after one of those, on a word of three one-letter sounds (the only words those misses are named on).
 *
 * Leak rule: the ring carries a place and nothing else. No sound plays, no letter is named, and the scene fact names
 * the position ("the last letter"), never the letter, its sound or the word. The learner still decodes it.
 *
 * One definition for every word-reading lever set; the component draws the ring from `lookAgainAt`.
 */
import type { LeverSpec } from '../../../components/live-activity/bossLevers';
import { POSITION_MISSES, POSITION_WORDS, missedPosition } from './spokenReadingMisses';

export const LOOK_AGAIN_LEVER = 'look_again';

export interface LookAgain { at: number }

/** The letter to ring on a word of `sounds` one-letter sounds after `miss`, or null. */
export const lookAgainAt = (sounds: number, miss?: string): LookAgain | null => {
  const at = missedPosition(miss);
  return at != null && sounds === 3 ? { at } : null;
};

export const lookAgainFact = (ring: LookAgain) =>
  `A ring is around the ${POSITION_WORDS[ring.at]} letter: the place where the learner's word was different. `
  + 'Nothing is said about that letter.';

/** The spec for a lever set whose items print one word; `soundsOf` is the word's count of printed sounds. */
export function lookAgainSpec<I, C>(modes: readonly string[], soundsOf: (item: I) => number): LeverSpec<I, C> {
  return {
    id: LOOK_AGAIN_LEVER, type: 'marks', modes, answers: POSITION_MISSES,
    when: 'The learner says a real word with one sound changed.',
    does: 'Rings the one letter where the learner\'s word was different: its place only. Say "look at this letter again" '
      + 'and wait; never say its sound, its name or the word.',
    content: (item, _ctx, lastMiss) => lookAgainAt(soundsOf(item), lastMiss),
    fact: (ring: LookAgain) => lookAgainFact(ring),
  };
}
