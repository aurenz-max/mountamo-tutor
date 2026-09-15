import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';

export interface AnalogClockPipState extends PipPhaseGate {
  type: 'read' | 'set_time' | 'match' | 'elapsed' | 'hand_name' | 'count_face' | 'hear_time';
  /** Rendered targets: `clock` (not on hear_time, where the dial is hidden), `options` (hear_time), `touched`. */
  visibleIds: string[];
  /** `clock` for any touch on the dial, `touched` for a control or choice outside it. */
  touchedId?: 'clock' | 'touched';
}

/** Pip outlines the clock face as a whole. It never points at one hand, since the
 * hands are the answer on hand_name and what the child moves on set_time, and it
 * never picks a numeral or an option. On hear_time the four option faces are the
 * whole surface, so their grid is the cue. A touch anywhere on the dial is
 * watched as the dial, never as the hand under the finger.
 */
export function analogClockPipPose(state: AnalogClockPipState): PipPose {
  return pipPhasePose(state, {
    visibleIds: state.visibleIds,
    cueId: state.type === 'hear_time' ? 'options' : 'clock',
    attendId: state.touchedId,
  });
}
