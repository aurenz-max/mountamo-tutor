/**
 * equation-balancer's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `equationBalancer.boss.ts`.
 * Counting atoms asks for one number from a closed list: the learner says it (the tutor judges the words against the
 * key) or taps it and presses Check Answer (the activity judges the tap), so simple is SAY_OR_SHOW. Balancing sets
 * every number in front of the formulas and checks them together, a board the activity checks (guided, complex).
 */
import type { BalancerMode, EquationBalancerMiss } from './equationBalancerWorkspace';
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** What a wrong answer shows (`countMiss`, `balanceMiss`), by mode; the same ids name a spoken count's known misses. */
export const BALANCER_MISSES: Record<BalancerMode, readonly EquationBalancerMiss[]> = {
  simple: ['ignored_coefficient', 'ignored_subscript', 'ignored_parentheses', 'one_compound_only', 'added_not_multiplied', 'miscounted'],
  guided: ['not_lowest', 'one_element_off', 'several_off'],
  complex: ['not_lowest', 'shared_element_off', 'one_element_off', 'several_off'],
};

const BALANCE = { answer: 'manipulate', judge: 'activity', flow: 'board',
  moves: 'sets the number in front of each formula with + and −, then presses Check Balance' } as const;

export const equationBalancerCard = defineCard<EquationBalancerMiss>({
  id: 'equation-balancer',
  grades: ['Grade 6', 'Grade 7', 'Grade 8'],
  modes: {
    simple: { ...SAY_OR_SHOW, moves: 'may instead tap a number and press Check Answer', misses: BALANCER_MISSES.simple },
    guided: { ...BALANCE, misses: BALANCER_MISSES.guided },
    complex: { ...BALANCE, misses: BALANCER_MISSES.complex },
  },
  words: {
    job: 'count the atoms of one element on one side of a chemical equation, or balance an equation with the smallest '
      + 'whole numbers in front of its formulas',
    answer: 'their answer',
    question: 'the ask and the equation',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
