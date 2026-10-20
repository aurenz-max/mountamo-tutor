/**
 * timeline-explorer's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `timelineExplorer.boss.ts`.
 * The learner first reads the timeline, then answers check items code builds from the events' time order. A closed
 * choice (which event a clue describes; when an event happened) is said (the tutor judges the words against the key)
 * or tapped and checked (the activity checks it), so every mode is SAY_OR_SHOW. Putting event cards in time order and
 * matching causes to effects have no key: the activity checks the cards, item by item inside the order and connect
 * modes (explore = identify; order = order and identify; connect = cause_effect and date).
 */
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/**
 * What a wrong answer shows (`TeachingAttempt.miss`), from the work the check reads, by item kind. The same ids name a
 * spoken item's known wrong answers.
 * - identify: `adjacent_event` (the event just before or after in time), `distant_event`;
 * - date: `adjacent_date`, `distant_date`;
 * - order: `reversed`, `adjacent_swap`, `two_swapped`, `one_moved`, `mixed_order`;
 * - cause_effect: `used_extra` (the effect no cause led to), `effect_before_cause`, `pairs_swapped`, `mixed_links`.
 */
export type ChoiceMiss = 'adjacent_event' | 'distant_event' | 'adjacent_date' | 'distant_date';
export type OrderMiss = 'reversed' | 'adjacent_swap' | 'two_swapped' | 'one_moved' | 'mixed_order';
export type LinkMiss = 'used_extra' | 'effect_before_cause' | 'pairs_swapped' | 'mixed_links';
export type TimelineMiss = ChoiceMiss | OrderMiss | LinkMiss;

export const KIND_MISSES: Readonly<Record<'identify' | 'date' | 'order' | 'cause_effect', readonly TimelineMiss[]>> = {
  identify: ['adjacent_event', 'distant_event'],
  date: ['adjacent_date', 'distant_date'],
  order: ['reversed', 'adjacent_swap', 'two_swapped', 'one_moved', 'mixed_order'],
  cause_effect: ['used_extra', 'effect_before_cause', 'pairs_swapped', 'mixed_links'],
};

const PICK = 'may instead tap a choice, then press Check Answer';

export const timelineExplorerCard = defineCard<TimelineMiss>({
  id: 'timeline-explorer',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
  modes: {
    explore: { ...SAY_OR_SHOW, moves: PICK, misses: KIND_MISSES.identify },
    order: { ...SAY_OR_SHOW, moves: `${PICK}; on a card-order item, moves the cards up and down, earliest at the top, then presses Check Order`,
      misses: [...KIND_MISSES.order, ...KIND_MISSES.identify] },
    connect: { ...SAY_OR_SHOW, moves: `${PICK}; on a matching item, taps each cause and then the event it led to, then presses Check Matches`,
      misses: [...KIND_MISSES.cause_effect, ...KIND_MISSES.date] },
  },
  words: {
    job: 'read a timeline, then answer questions about when its events happened and how they connect',
    answer: 'their answer',
    question: 'the printed question and the choices or cards',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
