import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';
import type { DecodableItemKind } from '../primitives/visual-primitives/literacy/decodableReaderScript';

export interface DecodableReaderPipState extends PipPhaseGate {
  kind: DecodableItemKind;
  /** Rendered targets: `line` (the printed line), `story` (read-along text), `question`. */
  visibleIds: string[];
}

/** A read line is pointed at as a whole line, never one word. A question is
 * pointed at through the story the child answers from when it is on screen
 * (read-along), otherwise the question card — never a choice card, and never a
 * single word of the story, which could be the answer.
 */
export function decodableReaderPipPose(state: DecodableReaderPipState): PipPose {
  const cueId = state.kind === 'read_line' ? 'line'
    : state.visibleIds.includes('story') ? 'story' : 'question';
  return pipPhasePose(state, { visibleIds: state.visibleIds, cueId, attendId: cueId });
}
