/**
 * shape-tracer's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `shapeTracer.boss.ts`.
 * Every mode is dots tapped on the canvas and checked by the activity itself: one item at a time, activity-judged,
 * a bespoke boss.
 */
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong check shows (`shapeTracerMiss`, `TeachingAttempt.miss`, handoff 20). Only connect-dots and
 * draw-from-description have a wrong check: a trace or completion tap that is not the next corner is refused on the
 * dot, never checked.
 * - connect-dots, from the dot tapped instead of the next number: `went_back` (a dot already joined),
 *   `started_elsewhere` (the first tap is not the first number), `skipped_number` (a later number);
 * - draw-from-description, from the checked corners: `too_few_sides`, `too_many_sides`, `sides_unequal` (the
 *   right count, but the clue asks for sides of one length and these are not).
 */
export type ShapeTracerMiss = 'went_back' | 'started_elsewhere' | 'skipped_number'
  | 'too_few_sides' | 'too_many_sides' | 'sides_unequal';

export const DOT_MISSES: readonly ShapeTracerMiss[] = ['started_elsewhere', 'skipped_number', 'went_back'];
export const DRAW_MISSES: readonly ShapeTracerMiss[] = ['too_few_sides', 'too_many_sides', 'sides_unequal'];

const TAPPED = { answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time' } as const;

export const shapeTracerCard = defineCard<ShapeTracerMiss>({
  id: 'shape-tracer',
  grades: ['Kindergarten', 'Grade 1'],
  // Every mode publishes levers (`shapeTracerLevers.ts`).
  modes: {
    trace: { ...TAPPED, misses: [],
      moves: 'taps the corners on the canvas one after another (Undo takes back the last); the shape closes on the last one' },
    connect_dots: { ...TAPPED, misses: DOT_MISSES,
      moves: 'taps the numbered dots in number order, starting at 1 (Undo takes back the last); the shape appears when every dot is joined' },
    complete: { ...TAPPED, misses: [],
      moves: 'taps the open corners one after another, carrying on from where the drawn sides stop (Undo takes back the last); '
        + 'the shape closes on the last one' },
    draw_from_description: { ...TAPPED, misses: DRAW_MISSES,
      moves: 'taps grid dots to place corners in turn around the shape (Undo takes back the last), then presses Check Shape' },
  },
  words: {
    job: 'build a shape by tapping dots: trace a shape\'s corners, join numbered dots to find a hidden shape, finish a '
      + 'half-drawn shape, or place corners on a grid to draw the shape a clue describes',
    answer: 'the corners or dots they tap and in what order (on joined dots, also the hidden shape until every dot is '
      + 'joined; on a drawing, where the corners go and the name of the shape the clue describes)',
    question: 'the instruction, the shape it names, the numbers printed on the dots and corners, and a drawing\'s clue',
  },
  levers: true,
});
