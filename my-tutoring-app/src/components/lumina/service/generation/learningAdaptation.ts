/**
 * The adaptation metadata a generator stamps on its data when a validated
 * teaching move ran. Types only, so client components can import it without
 * the server-only planner behind `adaptationStep.ts`.
 *
 * `source` is stamped only by the observation delivery server; a generator
 * never claims it.
 */
export type LearningAdaptationStatus = 'targeted' | 'already-targeted' | 'insufficient-capacity';

export interface LearningAdaptation<M extends string> {
  move: M;
  status: LearningAdaptationStatus;
  comparisonCount: number;
  source?: 'saved-observation';
}
