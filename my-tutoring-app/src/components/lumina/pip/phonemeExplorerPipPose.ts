import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';
import type { PhonemeItemKind } from '../primitives/visual-primitives/literacy/phonemeExplorerScript';

export interface PhonemeExplorerPipState extends PipPhaseGate {
  kind: PhonemeItemKind;
  /** Rendered targets: `stimulus` (the sound tile, heard word, or starting word),
   *  `sounds` and `sound-<i>` (blend tiles), `card-<i>` (menu cards). */
  visibleIds: string[];
  /** The card or tile the child last tapped to hear on this item. */
  lastTouchedId?: string;
}

/** Every mode is answered aloud. Pip points at the question side the ask names:
 * the sound tile (isolate), the heard word's card (ending, medial, segment), the
 * starting word (manipulate), or the blend tiles as one row — never one tile,
 * never a menu card, which could be the answer, and never the worked example the
 * hard tier removes. It watches whatever the child taps to hear.
 */
export function phonemeExplorerPipPose(state: PhonemeExplorerPipState): PipPose {
  const cueId = state.kind === 'blend' ? 'sounds' : 'stimulus';
  return pipPhasePose(state, { visibleIds: state.visibleIds, cueId, attendId: state.lastTouchedId ?? cueId });
}
