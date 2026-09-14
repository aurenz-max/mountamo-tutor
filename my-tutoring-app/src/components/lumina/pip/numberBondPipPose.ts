import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';

export interface BondPipState extends PipPhaseGate {
  answerKind: 'voice' | 'gesture';
  /** Equation or family build: the child assembles tiles into the slot row. */
  building: boolean;
  /** Missing-part inference with the covered part still covered. */
  covered: boolean;
  /** Rendered targets: `board`, `covered`, `equation`. */
  visibleIds: string[];
  lastTouchedId?: string;
}

/** Pip attends to regions, never to a tile, an action button, or a counter:
 * a pointed tile writes the equation, a pointed action names the operation, and
 * a pointed counter suggests the split. It points at where the work happens —
 * the slot row, the covered part, or the bond — and receives what was built.
 */
export function numberBondPipPose(state: BondPipState): PipPose {
  const cueId = state.building ? 'equation' : state.covered ? 'covered' : 'board';
  const attendId = state.answerKind === 'gesture' ? state.lastTouchedId : cueId;
  return pipPhasePose(state, {
    visibleIds: state.visibleIds, cueId, attendId, handover: state.answerKind === 'gesture',
  });
}
