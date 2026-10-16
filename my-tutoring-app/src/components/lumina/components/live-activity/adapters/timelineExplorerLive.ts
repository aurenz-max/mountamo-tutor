import type { TimelineExplorerData } from '../../../primitives/visual-primitives/core/TimelineExplorer';
import { deckOf, resolveKinds, sessionPlan, timelineItems, validTimelineItem } from '../../../primitives/visual-primitives/core/timelineExplorerWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/**
 * Reject a timeline a mode cannot be asked on: no title, fewer than five events, a stored item code could not have
 * built from these events (every key comes from the events' time order or their led-to links), or a session with no
 * item of a requested kind.
 */
export function validateTimelineExplorerData(value: unknown): TimelineExplorerData {
  const d = value as TimelineExplorerData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated timeline has invalid lesson content.');
  if (!Array.isArray(d.events) || d.events.length < 5) throw new Error('Generated timeline has too few events.');
  const deck = deckOf(d.events);
  if (Array.isArray(d.items) && d.items.some(i => !validTimelineItem(deck, i))) throw new Error('A generated timeline item is not one code can key.');
  const items = timelineItems(d);
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Generated timeline items repeat an id.');
  const kinds = resolveKinds(d);
  // cause_effect falls back to a date item when the events have too few links; every other kind must appear.
  for (const kind of Array.from(new Set(sessionPlan(kinds)))) {
    if (kind === 'cause_effect' ? !items.some(i => i.kind === 'cause_effect' || i.kind === 'date') : !items.some(i => i.kind === kind)) {
      throw new Error(`The timeline-explorer ${kind} items could not be built.`);
    }
  }
  return d;
}

/** What the live adapter needs from the timeline; the catalog's `teachingWorkspace` declares the rest. */
export const timelineExplorerLiveDomain: WorkspaceDomain<TimelineExplorerData> = {
  validate: validateTimelineExplorerData,
  initialState: d => workspaceOpening({ title: d.title,
    task: `Read the timeline "${d.title}": open every event, then begin the questions.`, total: timelineItems(d).length }),
};
