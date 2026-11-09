/**
 * life-lab's card: how it is wired to the live tutor (`components/live-activity/boss.ts`). The catalog reads it; the
 * behavior is `lifeLab.boss.ts`. One mode (USER 2026-11-08: an agent primitive takes a topic or objective, and a mode is
 * too narrow an input): the author builds whatever world the objective needs. A world whose answer is one named thing
 * (a part, a coloring, a prediction) is said or tapped and carries a spoken key (`lifeLabSpoken.ts`); every other world
 * is shown and the activity's own check judges it, so no key reaches the tutor.
 *
 * The skill labels below are read from each finished world by code (`classify` in `lifeLabWorld.ts`). They describe a
 * world for the screen, standards and misses; they never limit what the author may build.
 */
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO } from '../../../../components/live-activity/boss';
import type { SurfaceMiss } from '../../../../service/agent-kit/surfaces';

/** What a wrong check on a kit item can show (`SURFACE_MISSES`; a card holds facts only, so the list is written here). */
const ITEM_MISSES: readonly SurfaceMiss[] = ['wrong_choice', 'misplaced', 'out_of_order'];

/** The one eval mode. */
export const LIFE_EVAL_MODE = 'world';

export const LIFE_MODES = [
  'where_it_lives', 'what_it_needs', 'part_for_the_job', 'hide_from_the_hunter', 'whose_baby', 'spread_the_seeds',
  'life_cycle', 'follow_the_path', 'survive_and_change', 'fair_test',
] as const;
export type LifeLabMode = typeof LIFE_MODES[number];

export type LifeLabMiss =
  | 'wrong_home' | 'unmet_need' | 'not_fair_test' | 'wrong_part' | 'seen_by_hunter' | 'wrong_prediction'
  | 'trait_from_neither' | 'not_in_cycle' | 'out_of_order' | 'wrong_medium' | 'no_way_in' | 'not_a_breathing_part'
  | 'stops_short' | 'not_this_animal' | 'too_many_parts' | SurfaceMiss;

/** What a wrong check can show (`missOf` in `lifeLabWorld.ts`), per kind of world. */
export const MODE_MISSES: Record<LifeLabMode, readonly LifeLabMiss[]> = {
  where_it_lives: ['wrong_home'], what_it_needs: ['unmet_need'], fair_test: ['not_fair_test'],
  part_for_the_job: ['wrong_part'], spread_the_seeds: ['wrong_part'], hide_from_the_hunter: ['seen_by_hunter'],
  survive_and_change: ['wrong_prediction'], whose_baby: ['trait_from_neither'], life_cycle: ['not_in_cycle', 'out_of_order'],
  follow_the_path: ['wrong_medium', 'no_way_in', 'not_a_breathing_part', 'stops_short', 'not_this_animal', 'too_many_parts'],
};

export const lifeLabCard = defineCard<LifeLabMiss>({
  id: 'life-lab',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  audio: SPOKEN_AUDIO,
  // Levers: every world carries its own help and simplify levers, authored with it (`service/agent-kit/levers.ts`).
  levers: true,
  modes: {
    [LIFE_EVAL_MODE]: {
      ...SAY_OR_SHOW,
      misses: Array.from(new Set<LifeLabMiss>([...LIFE_MODES.flatMap(m => MODE_MISSES[m]), ...ITEM_MISSES])),
      moves: 'says or taps a part, a coloring, a prediction or a card when the item asks for one; otherwise moves animals, turns light, water or warmth, sorts cards, or taps pictures into boxes in order',
    },
  },
  words: {
    job: 'learn an idea about living things from what the lesson shows, then use it: pick, sort or order drawn cards, or change one thing in a small living world until the goal holds; "I’m done!" checks it',
    answer: 'the cards or the world as the learner set them',
    question: 'what is drawn, what can change, the goal, and what each run showed',
    special: 'Short sentences, everyday words. When the facts have teaching, say that frame in your own words and point at the drawing before anything else; '
      + 'the task opens after the learner taps through. On a new world say what the places are like and who lives there, then the goal; '
      + 'invite one idea to try with Run. After a run, say what happened in the facts’ words. Never say which choice is right.',
  },
});
