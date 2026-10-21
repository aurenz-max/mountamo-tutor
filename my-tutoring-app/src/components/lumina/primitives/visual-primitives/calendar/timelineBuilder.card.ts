/**
 * timeline-builder's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `timelineBuilder.boss.ts`.
 * Every mode is one timeline the learner fills from a mixed-up bank of event cards and checks as a whole: the activity
 * checks the order (a board). The modes differ only in the timeline's scale: a day, a year, history.
 */
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong order shows (`timelineMiss`, `TeachingAttempt.miss`, handoff 20), read from the placed order alone:
 * - `reversed`: latest to earliest, every event mirrored;
 * - `adjacent_swap`: two neighbouring events traded places, the rest right (events close in time);
 * - `two_swapped`: two events further apart traded places, the rest right;
 * - `one_moved`: one event put in the wrong place, the others in the right order around it;
 * - `mixed_order`: anything else.
 */
export type TimelineMiss = 'reversed' | 'adjacent_swap' | 'two_swapped' | 'one_moved' | 'mixed_order';
export const TIMELINE_MISSES: readonly TimelineMiss[] = ['reversed', 'adjacent_swap', 'two_swapped', 'one_moved', 'mixed_order'];

const ORDER = { answer: 'manipulate', judge: 'activity', flow: 'board',
  moves: 'taps an event card, then taps a slot to place it (tapping a filled slot empties it), and with every slot '
    + 'filled presses Check Order', misses: TIMELINE_MISSES } as const;

export const timelineBuilderCard = defineCard<TimelineMiss>({
  id: 'timeline-builder',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
  // Every mode publishes levers (`timelineBuilderLevers.ts`); every miss is answered on every mode.
  modes: {
    'sequence-daily': ORDER,
    'sequence-yearly': ORDER,
    'place-historical': ORDER,
  },
  words: {
    job: 'put the events of a timeline in time order, from the start of the timeline on the left to its end on the '
      + 'right: the events of a day, of a year, or of history',
    answer: 'the order of the events',
    question: 'the instruction, the two ends of the timeline and the event cards',
  },
  levers: true,
});
