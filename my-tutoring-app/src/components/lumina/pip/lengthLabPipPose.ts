import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';

export interface LengthLabPipState extends PipPhaseGate {
  type: 'compare' | 'tile_and_count' | 'order' | 'indirect' | 'estimate_then_tile' | 'two_unit_compare';
  /** Where this item is: `guess` before an estimate, `measure-a`/`measure-b` while a unit is laid, `answer` once both are. */
  step: 'guess' | 'measure' | 'measure-a' | 'measure-b' | 'answer';
  /** Rendered targets: `workspace`, `objects` (compare, order), `clues` (indirect),
   *  `measure`/`measure-a`/`measure-b` (the object with its tile row), and `touched`. */
  visibleIds: string[];
  hasTouch: boolean;
}

/** Pip shows WHAT is being measured: the objects side by side, the clues, or
 * the object together with the row its units go in. Never a unit mark, a tile
 * count, or an answer button; where every tappable thing is a choice (the guess
 * row, the which-unit question) it outlines the whole workspace. Checking is
 * synchronous, so there is no handover to receive.
 */
export function lengthLabPipPose(state: LengthLabPipState): PipPose {
  const cueId = state.type === 'compare' || state.type === 'order' ? 'objects'
    : state.type === 'indirect' ? 'clues'
      : state.step === 'measure' || state.step === 'measure-a' || state.step === 'measure-b' ? state.step
        : 'workspace';
  return pipPhasePose(state, {
    visibleIds: state.visibleIds, cueId, attendId: state.hasTouch ? 'touched' : undefined,
  });
}
