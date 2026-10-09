import type { TimelineBuilderData, TimelineBuilderChallenge } from '../../../primitives/visual-primitives/calendar/TimelineBuilder';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

const TYPES = ['daily', 'yearly', 'historical'];

/** A challenge the activity's check can answer: 2+ labelled events whose positions are exactly 0..n-1. */
const answerable = (c: TimelineBuilderChallenge) => !!c && typeof c.id === 'string' && !!c.id && TYPES.includes(c.type)
  && typeof c.instruction === 'string' && !!c.instruction.trim() && Array.isArray(c.events) && c.events.length >= 2
  && new Set(c.events.map(e => e?.id)).size === c.events.length
  && c.events.every(e => e && typeof e.label === 'string' && !!e.label.trim())
  && [...c.events.map(e => e.correctPosition)].sort((a, b) => a - b).every((p, i) => p === i);

/** What the live adapter needs from the timeline builder; the catalog's `teachingWorkspace` declares the rest. */
export const timelineBuilderLiveDomain: WorkspaceDomain<TimelineBuilderData> = {
  validate: value => validateChallengePool<TimelineBuilderData>(value, answerable, {
    pool: 'Generated timeline builder has invalid lesson content.',
    item: 'A timeline-builder challenge cannot be ordered as generated.',
  }),
  initialState: d => workspaceOpening({ title: d.title, task: d.challenges[0].instruction, total: d.challenges.length }),
};
