import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';
import type { BarModelEvalMode } from '../primitives/visual-primitives/math/BarModel';

export interface BarModelPipState extends PipPhaseGate {
  evalMode: BarModelEvalMode;
  /** The row the screen already marks with its "read this one" highlight. Null
   *  when the mode names no row or the support tier withdrew the mark. */
  markedRowIndex: number | null;
  /** Rendered targets: `graph` (every graph on screen), `row-<i>`, `source` (the pile), `controls` (build_graph), `touched`. */
  visibleIds: string[];
  hasTouch: boolean;
}

/** Pip points at one row only when the screen already marks it; a tier that
 * withdraws the highlight does not get it back from Pip. Rows are the answer
 * on most/fewest, compare and match, so there the graph is outlined as a
 * whole. match_to_bar starts at the group being counted, build_graph at its
 * controls. Checking is synchronous; there is no handover to receive.
 */
export function barModelPipPose(state: BarModelPipState): PipPose {
  const { visibleIds } = state;
  const cueId = state.markedRowIndex != null ? `row-${state.markedRowIndex}`
    : state.evalMode === 'match_to_bar' && visibleIds.includes('source') ? 'source'
      : state.evalMode === 'build_graph' ? 'controls'
        : 'graph';
  return pipPhasePose(state, { visibleIds, cueId, attendId: state.hasTouch ? 'touched' : undefined });
}
