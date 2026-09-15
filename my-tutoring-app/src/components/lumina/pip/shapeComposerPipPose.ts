import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';

export interface ShapeComposerPipState extends PipPhaseGate {
  /** Rendered targets: `canvas`, `palette`, `choices` (decompose shape buttons),
   *  `entry` (how-many box), and one `piece-*` per shape on the canvas. */
  visibleIds: string[];
  lastTouchedId?: string;
}

/** Palette pieces and the decompose shape buttons are answers, and where a piece
 * goes is the composition itself (the seams that show it are withdrawn above easy).
 * Pip points only at the canvas as a whole — the silhouette, picture or composite
 * the child works on — and watches the piece the child moved. Check Answer is
 * synchronous, so the build is never held open to be received.
 */
export function shapeComposerPipPose(state: ShapeComposerPipState): PipPose {
  return pipPhasePose(state, { visibleIds: state.visibleIds, cueId: 'canvas', attendId: state.lastTouchedId });
}
