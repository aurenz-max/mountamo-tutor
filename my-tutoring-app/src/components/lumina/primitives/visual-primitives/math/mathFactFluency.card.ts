/**
 * math-fact-fluency's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `mathFactFluency.boss.ts`.
 * A number answer is said (the tutor judges the words against the key) or shown: tapped among the choices on a visual
 * fact or a bare fact, or set with the − and + buttons and Submitted on a missing number or rapid recall, which the
 * activity checks. So those four modes are SAY_OR_SHOW. A match is tapped only: "that one" names no equation or
 * picture, so its key never reaches the tutor.
 */
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO, TAP_ONE } from '../../../components/live-activity/boss';

/**
 * What a wrong answer shows (`mathFactMiss` on a tap or Submit, the spoken misses by the same ids), from the number
 * answered (a number, an equation's total, or a picture's count): `other_operation` (the two printed numbers combined
 * the other way), `printed_number` (a number already in the printed fact), then how far off it is. A
 * picture-to-equation match prints no fact, so it names only how far off the chosen equation's total is.
 */
export type MathFactMiss = 'other_operation' | 'printed_number' | 'one_short' | 'one_over' | 'short_by_more' | 'over_by_more';
export const MATH_FACT_MISSES: readonly MathFactMiss[] =
  ['other_operation', 'printed_number', 'one_short', 'one_over', 'short_by_more', 'over_by_more'];

const TAP = 'may instead tap the number among the choices';
const STEP = 'may instead set the number with the − and + buttons, then press Submit';

export const mathFactFluencyCard = defineCard<MathFactMiss>({
  id: 'math-fact-fluency',
  grades: ['Kindergarten', 'Grade 1'],
  modes: {
    visual_fact: { ...SAY_OR_SHOW, moves: TAP, misses: MATH_FACT_MISSES },
    match: { ...TAP_ONE, moves: 'taps the equation that matches the picture, or the picture that matches the printed fact',
      misses: MATH_FACT_MISSES },
    equation_solve: { ...SAY_OR_SHOW, moves: TAP, misses: MATH_FACT_MISSES },
    missing_number: { ...SAY_OR_SHOW, moves: STEP, misses: MATH_FACT_MISSES },
    // Aid-free recall (user ruling 2026-10-02): a picture would make it equation_solve, and recall has no step to make
    // simpler, so no lever answers its misses.
    speed_round: { ...SAY_OR_SHOW, moves: STEP, misses: MATH_FACT_MISSES, unanswered: MATH_FACT_MISSES },
  },
  words: {
    job: 'answer addition and subtraction facts, calmly and with no timer: count a picture, solve a printed fact, find '
      + 'its missing number, or match a picture to its fact',
    answer: 'the answer',
    question: 'the instruction and the printed fact',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
