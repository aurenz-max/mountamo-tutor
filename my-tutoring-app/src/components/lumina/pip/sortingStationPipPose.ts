import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';
import type { SortingItemKind } from '../primitives/visual-primitives/math/sortingStationScript';

export interface SortingPipState extends PipPhaseGate {
  kind: SortingItemKind;
  /** `tray-<label>` of the group a count ask names aloud. */
  namedTrayId?: string;
  /** Rendered targets: `focus`, `cards`, `trays`, `tray-<label>`. */
  visibleIds: string[];
}

/** Every answer here is spoken, and every answer is a tray or a card, so Pip
 * never singles one out unless the ask already named it: the focus card on a
 * sort, the counted group on a count. Compare, odd-one-out and pick-the-rule
 * get the whole row or tray set, never one member of it.
 */
export function sortingStationPipPose(state: SortingPipState): PipPose {
  const { visibleIds } = state;
  const cueId = state.kind === 'sort' || state.kind === 'both_criteria' ? 'focus'
    : state.kind === 'count_group' ? (state.namedTrayId && visibleIds.includes(state.namedTrayId) ? state.namedTrayId : 'trays')
      : state.kind === 'compare' ? 'trays'
        : 'cards';
  return pipPhasePose(state, { visibleIds, cueId, attendId: cueId });
}
