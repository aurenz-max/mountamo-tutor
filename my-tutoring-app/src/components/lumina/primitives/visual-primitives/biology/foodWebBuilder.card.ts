/**
 * food-web-builder's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `foodWebBuilder.boss.ts`.
 * Both modes are arrows the learner draws and the activity checks against the lesson's feeding relations: the whole
 * web is one board of arrows checked together; a food chain is one build at a time. No key reaches the tutor.
 */
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong chain shows (`foodChainMiss`, `TeachingAttempt.miss`), most specific first:
 * - `arrow_backwards`: an arrow points from the eater to its food (the reverse is a real feeding relation);
 * - `not_a_feeding_pair`: an arrow joins two living things where neither eats the other;
 * - `broken_chain`: the arrows are not one line through every living thing placed (a gap, a branch, one left out);
 * - `wrong_end`: one right chain, but it does not end at the living thing asked for;
 * - `no_producer`: it ends right, but does not start with a living thing that makes its own food;
 * - `too_short` / `too_long`: a right chain to the right end with fewer or more living things than asked.
 */
export type FoodChainMiss = 'arrow_backwards' | 'not_a_feeding_pair' | 'broken_chain' | 'wrong_end' | 'no_producer' | 'too_short' | 'too_long';
export const FOOD_CHAIN_MISSES: readonly FoodChainMiss[] = ['arrow_backwards', 'not_a_feeding_pair', 'broken_chain', 'wrong_end', 'no_producer', 'too_short', 'too_long'];

/**
 * What a wrong whole web shows (`foodWebMiss`): `backwards_arrows` (an arrow is a real relation turned round),
 * `wrong_arrows` (an arrow between living things that do not feed each other), `missing_arrows`.
 */
export type FoodWebMiss = 'backwards_arrows' | 'wrong_arrows' | 'missing_arrows';
export const FOOD_WEB_MISSES: readonly FoodWebMiss[] = ['backwards_arrows', 'wrong_arrows', 'missing_arrows'];

export const foodWebBuilderCard = defineCard<FoodChainMiss | FoodWebMiss>({
  id: 'food-web-builder',
  grades: ['Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
  // Both modes publish levers (`foodWebLevers.ts`).
  modes: {
    complete_web: { answer: 'build', judge: 'activity', flow: 'board', misses: FOOD_WEB_MISSES,
      moves: 'taps one living thing and then another to draw an arrow from the first to the second, for every feeding '
        + 'relationship, then presses Check' },
    build_chain: { answer: 'build', judge: 'activity', flow: 'one-at-a-time', misses: FOOD_CHAIN_MISSES,
      // The ask on screen names the living thing the chain ends at.
      unanswered: ['wrong_end'],
      moves: 'taps living things in the list to put them in the empty scene (again to take one out), taps one in the '
        + 'scene and then another to draw an arrow from the first to the second, then presses the I\'m done! button' },
  },
  words: {
    job: 'draw feeding arrows from each food to its eater: every feeding relationship in the whole web, or one food '
      + 'chain of the asked length that ends at the asked living thing',
    answer: 'whether each arrow joins a food to its eater',
    question: 'the task, the ecosystem, the names of the living things and, on the whole web, the level label each one shows',
  },
  levers: true,
});
