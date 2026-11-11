/**
 * Item choice inside a lesson already selected, from the learner's component tallies (contract.ts): which units a
 * generator's items read touch a component this child misreads. It never selects a lesson, sets a gate or feeds
 * IRT (user ruling 2026-11-10); a word space only orders equal candidates by it.
 *
 * The tallies arrive in the backend-signed launch packet (`generation/generationRequest.ts`); with no packet, or
 * no weak component, there is no scorer and picking is unchanged. Server-only.
 */
import 'server-only';
import { deliveredLearningObservations } from '../generation/generationRequest';
import { unitPairs } from './registry';

/** A pair counts as weak after this many reads... */
export const WEAK_MIN_READS = 2;
/** ...below this share read correctly (the grid's middle band starts at 7 in 10; this sits just above it). */
export const WEAK_BELOW = 0.8;

/**
 * A scorer for `letter_sound` units (a word read aloud, or `letter:<letters>`): the miss rate of the weakest weak pair
 * the units contain, 0 when they contain none. Null when this request carries no weak pair.
 */
export function weakLetterSoundScorer(): ((units: readonly string[]) => number) | null {
  const tallies = deliveredLearningObservations()?.components?.letter_sound;
  if (!tallies) return null;
  const weak = new Map<string, number>();
  for (const [id, [attempts, correct]] of Object.entries(tallies)) {
    if (attempts >= WEAK_MIN_READS && correct / attempts < WEAK_BELOW) weak.set(id, 1 - correct / attempts);
  }
  if (!weak.size) return null;
  return units => {
    let worst = 0;
    for (const u of units) for (const id of unitPairs(u)) worst = Math.max(worst, weak.get(id) ?? 0);
    return worst;
  };
}
