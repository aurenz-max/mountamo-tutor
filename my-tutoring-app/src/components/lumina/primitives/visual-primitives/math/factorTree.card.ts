/**
 * factor-tree's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `factorTree.boss.ts`.
 * Every mode is one composite split on a tree until every leaf is prime; the activity checks each split. The guided
 * modes list the selected number's factor pairs to tap; the others take two typed factors. One tree at a time: a
 * bespoke boss.
 */
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong split shows (`factorMiss`, `TeachingAttempt.miss`, handoff 20), drawn from the old catalog's
 * commonStruggles (using 1 as a factor) and the factor-pair errors a split can show:
 * - `used_one`: 1 × the number (the product is right, the pair is useless);
 * - `added`: two numbers that add to the number instead of multiplying to it;
 * - `wrong_partner`: one factor divides the number, but the other is not the number divided by it;
 * - `not_a_factor`: neither number divides the number.
 */
export type FactorTreeMiss = 'used_one' | 'added' | 'wrong_partner' | 'not_a_factor';

const MISSES: readonly FactorTreeMiss[] = ['used_one', 'added', 'wrong_partner', 'not_a_factor'];
export const FACTOR_TREE_MISSES_BY_MODE: Record<string, readonly FactorTreeMiss[]> = {
  guided_small: MISSES, guided_medium: MISSES, unguided: MISSES, unguided_large: MISSES,
  assessment_intro: MISSES, assessment: MISSES,
};

const GUIDED = { answer: 'tap', judge: 'activity', flow: 'one-at-a-time', misses: MISSES,
  moves: 'taps a number on the tree that is not prime, then taps one of the suggested factor pairs listed for it, or '
    + 'types two factors in Factor 1 and Factor 2 and presses Split' } as const;
const TYPED = { answer: 'type', judge: 'activity', flow: 'one-at-a-time', misses: MISSES,
  moves: 'taps a number on the tree that is not prime, types two factors in Factor 1 and Factor 2, and presses Split' } as const;

export const factorTreeCard = defineCard<FactorTreeMiss>({
  id: 'factor-tree',
  grades: ['Grade 4', 'Grade 5', 'Grade 6', 'Grade 7'],
  // Every mode publishes levers (`factorTreeLevers.ts`); every miss is answered by a help lever on every item.
  modes: {
    guided_small: GUIDED,
    guided_medium: GUIDED,
    unguided: TYPED,
    unguided_large: TYPED,
    assessment_intro: TYPED,
    assessment: TYPED,
  },
  words: {
    job: 'find the prime factorization of a number with a factor tree: split it into two factors that multiply to '
      + 'it, neither of them one, then keep splitting every factor that is not prime until every leaf is prime',
    answer: 'each split they make',
    question: 'the number to factor and the splits and leaves already on the tree',
  },
  levers: true,
});
