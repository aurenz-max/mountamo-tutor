import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';
import type { MeasureLabChallengeType } from '../primitives/visual-primitives/math/MeasureLab';

export interface MeasureLabPipState extends PipPhaseGate {
  type: MeasureLabChallengeType;
  /** balance / capacity: the prediction is committed. pour_count: the container is full. */
  committed: boolean;
  /** Rendered targets: `objects` (the prediction pair), `scale`, `containers`,
   *  `container-*`, `container` (pour_count), `cups`, and `count-*`. */
  visibleIds: string[];
  lastTouchedId?: string;
}

/** Every weight and capacity is hidden, so the thing Pip must never do is pick
 * a side before the test shows it.
 * - Heavier: before the prediction both objects are the choices, so the pair as a
 *   whole; after it, the scale the child loads.
 * - Holds more and least to most: every container is a choice, so the group.
 * - How many cups: the container to fill while pouring; once it is full, the cups
 *   row the child poured from — never a number option.
 * While the beam settles or both containers fill, Pip watches that test.
 */
export function measureLabPipPose(state: MeasureLabPipState): PipPose {
  const cueId = state.type === 'balance_predict' ? (state.committed ? 'scale' : 'objects')
    : state.type === 'pour_count' ? (state.committed ? 'cups' : 'container')
      : 'containers';
  const attendId = state.judging
    ? (state.type === 'balance_predict' ? 'scale' : 'containers')
    : state.lastTouchedId;
  return pipPhasePose(state, { visibleIds: state.visibleIds, cueId, attendId });
}
