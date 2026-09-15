import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';

export interface ShapeSorterPipState extends PipPhaseGate {
  /** Rendered targets: `shape` (the ringed pool shape, the large count shape,
   *  or the real object) and `mats` on sort. */
  visibleIds: string[];
}

/** Every answer here is a word said aloud, and the ask always says "this
 * shape": the screen already rings it (or draws it alone), so Pip points at
 * that one shape on every mode and watches it while the answer is judged.
 * The mats are the sort answers; Pip never points at the mats or at a mat.
 */
export function shapeSorterPipPose(state: ShapeSorterPipState): PipPose {
  return pipPhasePose(state, { visibleIds: state.visibleIds, cueId: 'shape', attendId: 'shape' });
}
