/**
 * Item choice inside a lesson already selected, from the learner's component tallies (contract.ts): which units a
 * generator's items read touch a component this child misreads. It never selects a lesson, sets a gate or feeds
 * IRT (user ruling 2026-11-10); a word space only orders equal candidates by it.
 *
 * The weak-component rule is shared by every kind (`weak.ts`); this file adds the letter-sound unit lookup, which
 * needs the word library. Server-only.
 */
import 'server-only';
import { unitPairs } from './registry';
import { thinComponents, weakComponents } from './weak';

export { WEAK_BELOW, WEAK_MIN_READS } from './weak';

/**
 * A scorer for `letter_sound` units (a word read aloud, or `letter:<letters>`): the miss rate of the weakest weak pair
 * the units contain, 0 when they contain none. Null when this request carries no weak pair.
 */
export const weakLetterSoundScorer = () => weakPairScorer('letter_sound');

/**
 * The same scorer over the `spelling` tallies, for words the child builds from letters. The two kinds are read apart:
 * a pair misspelled does not lean a reading draw, and a pair misread does not lean a spelling draw.
 */
export const weakSpellingScorer = () => weakPairScorer('spelling');

/**
 * Coverage for `letter_sound` units: every pair the units contain with how much more evidence it needs (1 unread,
 * 0 once it has `WEAK_MIN_READS` reads). Null when this request carries no letter-sound tallies.
 */
export const letterSoundCoverage = () => pairCoverage('letter_sound');

/** The same over the `spelling` tallies. The two kinds are read apart, as the weak scorers are. */
export const spellingCoverage = () => pairCoverage('spelling');

function pairCoverage(kind: string): ((units: readonly string[]) => Array<[string, number]>) | null {
  const need = thinComponents(kind);
  if (!need) return null;
  return units => {
    const pairs = new Map<string, number>();
    for (const u of units) for (const id of unitPairs(u)) pairs.set(id, need(id));
    return Array.from(pairs);
  };
}

function weakPairScorer(kind: string): ((units: readonly string[]) => number) | null {
  const weak = weakComponents(kind);
  if (!weak) return null;
  return units => {
    let worst = 0;
    for (const u of units) for (const id of unitPairs(u)) worst = Math.max(worst, weak.get(id) ?? 0);
    return worst;
  };
}
