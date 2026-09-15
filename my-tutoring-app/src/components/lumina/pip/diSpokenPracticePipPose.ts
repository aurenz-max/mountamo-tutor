import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';
import type { SpokenPracticeItem } from '../primitives/visual-primitives/direct-instruction/diSpokenPracticeScript';

export interface DiSpokenPracticePipState extends PipPhaseGate {
  stimulusKind: SpokenPracticeItem['stimulusKind'];
  /** Rendered targets: `stimulus`, the panel holding the text or pictures. */
  visibleIds: string[];
}

/** The answer is always spoken, so the only thing on screen is the stimulus
 * panel. Pip outlines that panel as a whole — never one picture of a
 * compare_choice pair, where a pointed picture could stand for the describing
 * word, and never one object of a count. A listen-only item prints no stimulus
 * (hearing it is the task), so there is nothing to point at.
 */
export function diSpokenPracticePipPose(state: DiSpokenPracticePipState): PipPose {
  const cueId = state.stimulusKind === 'none' ? undefined : 'stimulus';
  return pipPhasePose(state, { visibleIds: state.visibleIds, cueId, attendId: cueId });
}
