import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';
import type { OrdinalLineKind } from '../primitives/visual-primitives/math/ordinalLineScript';

export interface OrdinalPipState extends PipPhaseGate {
  kind: OrdinalLineKind;
  /** Rendered targets: `stage`, `start`, `marked`, `symbol`, `slots`, `slot-N`, `picture-<name>`. */
  visibleIds: string[];
  lastTouchedId?: string;
}

/** A pointed character IS an ordinal answer, so Pip never singles one out
 * unless the ask already names it (the marked place in relative position,
 * which the hard tier withdraws; Pip does not put it back). Ordinal counting
 * starts at the line's start, so that is the cue for identify. The story cast
 * is shuffled and the order is heard, so Pip gives no cue there. A build is
 * pointed at its empty places, never at a tray picture, and is received.
 */
export function ordinalLinePipPose(state: OrdinalPipState): PipPose {
  const { visibleIds } = state;
  switch (state.kind) {
    case 'build_sequence':
      return pipPhasePose(state, { visibleIds, cueId: 'slots', attendId: state.lastTouchedId, handover: true });
    case 'sequence_story':
      return pipPhasePose(state, { visibleIds, attendId: 'stage' });
    case 'match':
      return pipPhasePose(state, { visibleIds, cueId: 'symbol', attendId: 'symbol' });
    case 'relative_position':
      return pipPhasePose(state, { visibleIds, cueId: visibleIds.includes('marked') ? 'marked' : 'start', attendId: 'stage' });
    default:
      return pipPhasePose(state, { visibleIds, cueId: 'start', attendId: 'stage' });
  }
}
