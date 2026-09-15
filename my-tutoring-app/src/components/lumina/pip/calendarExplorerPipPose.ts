import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';
import type { CalendarExplorerChallenge } from '../primitives/visual-primitives/calendar/CalendarExplorer';

export interface CalendarGridPipState extends PipPhaseGate {
  type: CalendarExplorerChallenge['type'];
  /** The child answers by tapping a date (identify by date, mark_events). */
  answerFromGrid: boolean;
  /** Rendered targets: `grid`, `offset` (the day_offset start card), `today`
   *  (the starred cell), `date-*` and `option-*`. */
  visibleIds: string[];
  lastTouchedId?: string;
}

/** Tap calendar. When a date is the answer every cell is a choice, so Pip
 * outlines the grid as a whole and never rings a cell — not even the starred
 * one, which could itself be the date asked for. When the answer is an option
 * button, the grid is only where the child looks things up: Pip rings the star
 * the screen already marks as today (the anchor for today, yesterday and
 * tomorrow), otherwise the grid. Days forward: the start-day card. Never a
 * target-day column, a marked endpoint, or an option. Checking is synchronous.
 */
export function calendarGridPipPose(state: CalendarGridPipState): PipPose {
  const cueId = state.type === 'day_offset' ? 'offset'
    : !state.answerFromGrid && state.visibleIds.includes('today') ? 'today'
      : 'grid';
  return pipPhasePose(state, { visibleIds: state.visibleIds, cueId, attendId: state.lastTouchedId });
}

/** Spoken day or month chain. Nothing is printed — the tutor says the day and
 * the child says the next one — so the only object is the listen card. Pip
 * outlines it during this item's cue and watches it while the answer is judged.
 */
export function calendarSequencePipPose(state: PipPhaseGate & { visibleIds: string[] }): PipPose {
  return pipPhasePose(state, { visibleIds: state.visibleIds, cueId: 'stimulus', attendId: 'stimulus' });
}
