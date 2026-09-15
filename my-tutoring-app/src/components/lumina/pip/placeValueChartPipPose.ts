import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';

export interface PlaceValueChartPipState extends PipPhaseGate {
  /** The item is a dictated build: the child writes digits into the chart. */
  gesture: boolean;
  /** Rendered targets: `stage` (the numeral or the chart) and `digit-<place>` (chart inputs). */
  visibleIds: string[];
  /** The chart column the child last focused on this item. */
  lastTouchedId?: string;
}

/** Spoken items print a numeral and ask for a place or a value; build items
 * dictate a number the child writes into the labeled columns. Pip points at the
 * stage as a whole on every item — never one digit or one column, which is the
 * answer on both. On a build it watches the column the child is writing in and
 * opens its hands while the written number is judged.
 */
export function placeValueChartPipPose(state: PlaceValueChartPipState): PipPose {
  const attendId = state.gesture ? state.lastTouchedId ?? 'stage' : 'stage';
  return pipPhasePose(state, { visibleIds: state.visibleIds, cueId: 'stage', attendId, handover: state.gesture });
}
