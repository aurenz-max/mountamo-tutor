import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';

export interface PatternBuilderPipState extends PipPhaseGate {
  /** The rendered phase: `copy` serves extend and find_rule. */
  phase: 'copy' | 'identify' | 'create' | 'translate';
  /** `slot-<n>` of the first "?" still empty on copy; absent once all are filled. */
  openSlotId?: string;
  /** Rendered targets: `pattern`, `slot-*`, `seq-*`, `build`, `token-*`, `built-*`. */
  visibleIds: string[];
  lastTouchedId?: string;
}

/** The palette tokens are the answers on every phase, so Pip never points at
 * one. Extend / find the rule: the next "?" slot — where the token goes, which
 * the screen already marks — or the pattern row once every slot is filled.
 * Identify the core: every token in the row is a choice, so the row as a
 * whole. Create and translate: the zone the child builds in. Otherwise Pip
 * follows the child's last touch; checking is synchronous, so nothing is received.
 */
export function patternBuilderPipPose(state: PatternBuilderPipState): PipPose {
  const cueId = state.phase === 'copy' ? state.openSlotId ?? 'pattern'
    : state.phase === 'identify' ? 'pattern'
      : 'build';
  return pipPhasePose(state, { visibleIds: state.visibleIds, cueId, attendId: state.lastTouchedId });
}
