/**
 * Periodic table's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `periodicTable.boss.ts`.
 * explore (Element Hunt) is one tap on a box, checked by the activity: its answer is a position on the table, which
 * has no spoken form. identify (Name It: an element's name read off the table) and trend (one of two named elements,
 * or a count of outer electrons) are spoken, judged by the tutor against the key.
 */
import { defineCard, OFF_BY, SPOKEN, SPOKEN_AUDIO, TAP_ONE } from '../components/live-activity/boss';
import type { OffByMiss } from '../components/live-activity/runtime/spokenMissContract';

/**
 * What a checked wrong tap shows on an Element Hunt (`periodicMiss`), by where the tapped box sits against the asked
 * one on the drawn table: `same_first_letter` (a spelled-symbol ask: the tapped symbol starts with the same letter),
 * `next_box` (the box touching it), `same_row` (the right period), `same_column` (the right group), `other_box`.
 */
export type PeriodicMiss = 'same_first_letter' | 'next_box' | 'same_row' | 'same_column' | 'other_box';
/** What a wrong spoken answer shows on Name It and Trends (`periodicSpokenMisses`). */
export type SpokenPeriodicMiss = 'other_of_pair' | 'group_number' | OffByMiss | 'said_symbol' | 'next_box';

/** The tap's own check and the spoken answers' known misses, by mode. */
export const PERIODIC_MISSES = {
  explore: ['same_first_letter', 'next_box', 'same_row', 'same_column', 'other_box'],
  identify: ['said_symbol', 'next_box'],
  trend: ['other_of_pair', 'group_number', ...OFF_BY],
} as const satisfies Record<string, readonly (PeriodicMiss | SpokenPeriodicMiss)[]>;

export const periodicTableCard = defineCard<PeriodicMiss | SpokenPeriodicMiss>({
  id: 'periodic-table',
  grades: ['Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
  modes: {
    explore: { ...TAP_ONE, misses: PERIODIC_MISSES.explore },
    identify: { ...SPOKEN, misses: PERIODIC_MISSES.identify },
    trend: { ...SPOKEN, misses: PERIODIC_MISSES.trend },
  },
  words: {
    job: 'tap the box for a named element, say the name of the element in a given box, or say which of two '
      + 'elements is bigger or more reactive or how many outer electrons one has',
    answer: 'the answer',
    question: 'the ask and its clue',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
