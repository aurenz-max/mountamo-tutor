/**
 * Which of a kind's components this learner is weak on, from the tallies in the backend-signed launch packet
 * (`generation/generationRequest.ts`). One rule for every kind; a picker (`wordSpace/pick.ts`)
 * uses it to order items inside a lesson already selected. It never selects a lesson, sets a gate or feeds IRT
 * (user ruling 2026-11-10). With no packet, or no weak component, there is no scorer and picking is unchanged.
 *
 * Kept apart from `bias.ts`, which loads the word library. Server-only.
 */
import 'server-only';
import { deliveredLearningObservations } from '../generation/generationRequest';

/** A component counts as weak after this many observations... */
export const WEAK_MIN_READS = 2;
/** ...below this share correct (the grid's middle band starts at 7 in 10; this sits just above it). */
export const WEAK_BELOW = 0.8;

/** The kind's weak component ids with their miss rate, or null when this request carries none. */
export function weakComponents(kind: string): Map<string, number> | null {
  const tallies = deliveredLearningObservations()?.components?.[kind];
  if (!tallies) return null;
  const weak = new Map<string, number>();
  for (const [id, [attempts, correct]] of Object.entries(tallies)) {
    if (attempts >= WEAK_MIN_READS && correct / attempts < WEAK_BELOW) weak.set(id, 1 - correct / attempts);
  }
  return weak.size ? weak : null;
}

/**
 * How much more evidence each component of a kind needs before it can be called weak or known: 1 with no
 * observation, falling to 0 at `WEAK_MIN_READS`. A picker draws items holding such components ahead of items whose
 * components are all observed, below any weak component, so a lesson's whole inventory gets read. Null when this
 * request carries no tallies for the kind (picking is unchanged).
 */
export function thinComponents(kind: string): ((id: string) => number) | null {
  const tallies = deliveredLearningObservations()?.components?.[kind];
  if (!tallies) return null;
  return id => Math.max(0, 1 - (tallies[id]?.[0] ?? 0) / WEAK_MIN_READS);
}

/** A scorer over component ids: the miss rate of the weakest weak component among them, 0 when none is weak. */
export function weakComponentScorer(kind: string): ((ids: readonly string[]) => number) | null {
  const weak = weakComponents(kind);
  if (!weak) return null;
  return ids => ids.reduce((worst, id) => Math.max(worst, weak.get(id) ?? 0), 0);
}
