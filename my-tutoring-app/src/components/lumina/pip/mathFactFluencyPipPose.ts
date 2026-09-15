import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';
import type { MathFactFluencyChallenge } from '../primitives/visual-primitives/math/MathFactFluency';

export interface MathFactFluencyPipState extends PipPhaseGate {
  type: MathFactFluencyChallenge['type'];
  matchDirection?: MathFactFluencyChallenge['matchDirection'];
  /** Rendered targets: `visual` (the dots, frame or fingers), `problem` (the
   *  printed equation with its "?"), `entry` (the stepper), and one id per
   *  choice: `option-*`, `equation-*`, `picture-*`. */
  visibleIds: string[];
  lastTouchedId?: string;
}

/** Every button here is an answer — a number, an equation, a picture — so Pip
 * never points at one. It points at what the child reads the fact from: the
 * picture on a visual fact or a picture-to-equation match, otherwise the printed
 * equation, whose "?" already marks the unknown. Checking is synchronous, so
 * nothing is received; otherwise Pip follows the child's last touch.
 */
export function mathFactFluencyPipPose(state: MathFactFluencyPipState): PipPose {
  const readsPicture = state.type === 'visual-fact'
    || (state.type === 'match' && state.matchDirection === 'visual-to-equation');
  const cueId = readsPicture && state.visibleIds.includes('visual') ? 'visual' : 'problem';
  return pipPhasePose(state, { visibleIds: state.visibleIds, cueId, attendId: state.lastTouchedId });
}
