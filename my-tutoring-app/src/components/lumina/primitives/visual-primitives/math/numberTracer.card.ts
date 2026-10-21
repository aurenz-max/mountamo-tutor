/**
 * number-tracer's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `numberTracer.boss.ts`.
 * Every mode is one numeral written on the canvas with a finger and checked by the canvas itself (geometry, then the
 * vision judge): one item at a time, activity-judged, a bespoke boss.
 */
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong check shows (`numberTracerMiss`, `TeachingAttempt.miss`, handoff 20), from what the check read:
 * - the vision judge's reading, when trusted: `other_numeral`, `digits_swapped` (a two-digit number's digits in
 *   reverse), `not_readable` (read as no numeral), `poorly_formed` (read as the numeral, scored under half);
 * - geometry, when there is no trusted reading: `part_left_out` (what is drawn follows the numeral, much of the
 *   numeral is not drawn), `shape_off` (the strokes do not follow the numeral, or its guide on a trace).
 */
export type NumberTracerMiss = 'other_numeral' | 'digits_swapped' | 'not_readable' | 'poorly_formed' | 'part_left_out' | 'shape_off';

export const NUMBER_TRACER_MISSES: readonly NumberTracerMiss[] =
  ['other_numeral', 'digits_swapped', 'not_readable', 'poorly_formed', 'part_left_out', 'shape_off'];
/** Sequence misses no lever can answer: any formation guide would draw the hidden numeral (NT-7). */
export const SEQUENCE_UNANSWERED: readonly NumberTracerMiss[] = ['poorly_formed', 'part_left_out', 'shape_off'];

const WRITTEN = { answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time',
  moves: 'writes on the canvas with a finger (Clear wipes it), then presses Check' } as const;

export const numberTracerCard = defineCard<NumberTracerMiss>({
  id: 'number-tracer',
  grades: ['Kindergarten', 'Grade 1'],
  // Every mode publishes levers (`numberTracerLevers.ts`).
  modes: {
    trace: { ...WRITTEN, misses: NUMBER_TRACER_MISSES },
    copy: { ...WRITTEN, misses: NUMBER_TRACER_MISSES },
    write: { ...WRITTEN, misses: NUMBER_TRACER_MISSES },
    sequence: { ...WRITTEN, misses: NUMBER_TRACER_MISSES, unanswered: SEQUENCE_UNANSWERED },
  },
  words: {
    job: 'write numerals by hand: trace a dotted numeral, copy one from a model, write one the instruction names, or '
      + 'write the missing number in a counting run',
    answer: 'the numeral they write (on a counting run, the missing number)',
    question: 'the instruction, the numeral it names or shows, and the numbers printed in a counting run',
  },
  levers: true,
});
