import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';
import type { TimeSequencerChallenge } from '../primitives/visual-primitives/math/TimeSequencer';

export interface TimeSequencerPipState extends PipPhaseGate {
  type: TimeSequencerChallenge['type'];
  /** Rendered targets: `events` (ordering list), `event` (time-of-day card),
   *  `reference` (before/after card), `durations`, `schedule`, and one id per
   *  tappable card or button (`card-*`, `period-*`, `option-*`, `duration-*`, `activity-*`). */
  visibleIds: string[];
  lastTouchedId?: string;
}

const CUE: Record<TimeSequencerChallenge['type'], string> = {
  'sequence-events': 'events',
  'clock-sequence': 'events',
  'match-time-of-day': 'event',
  'before-after': 'reference',
  'duration-compare': 'durations',
  'read-schedule': 'schedule',
};

/** Pip points only at what the question is about, never at a choice:
 * - ordering: every card is a possible "first", so the whole list;
 * - time of day and before/after: the one event card the question names, which
 *   is not tappable (the periods and option cards below it are the answers);
 * - duration: both activities are the answer buttons, so the pair as a whole;
 * - schedule: the table as a whole — the highlighted row holds the answer.
 * Otherwise Pip follows the card or button the child last touched.
 */
export function timeSequencerPipPose(state: TimeSequencerPipState): PipPose {
  return pipPhasePose(state, {
    visibleIds: state.visibleIds, cueId: CUE[state.type], attendId: state.lastTouchedId,
  });
}
