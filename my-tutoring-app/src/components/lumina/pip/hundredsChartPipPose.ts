import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';

export interface HundredsChartPipState extends PipPhaseGate {
  /** Rendered targets: `chart`, one `cell-*` per number, one `option-*` per choice. */
  visibleIds: string[];
  lastTouchedId?: string;
}

/** Every cell is a choice on highlight and complete, and every option is an answer
 * on identify and find-the-skip, so Pip points only at the chart as a whole and
 * otherwise watches the cell or option the child touched. Check is synchronous.
 */
export function hundredsChartPipPose(state: HundredsChartPipState): PipPose {
  return pipPhasePose(state, { visibleIds: state.visibleIds, cueId: 'chart', attendId: state.lastTouchedId });
}
