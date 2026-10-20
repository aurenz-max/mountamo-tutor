/**
 * reaction-lab's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `reactionLab.boss.ts`.
 * Every item is one challenge with a code-held key (a choice, true or false, or chemical or physical): the learner says
 * it (the tutor judges the words against the key) or taps it and presses Check Answer (the activity judges the tap), so
 * every mode is SAY_OR_SHOW. A predict challenge is asked beside the unmixed substances; every other challenge opens
 * once the learner presses Mix Substances!.
 */
import type { ReactionMiss } from './reactionLabWorkspace';
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** What a wrong choice shows (`reactionMiss`), by mode; the same ids name each spoken item's known misses. */
export const REACTION_MISSES: Record<'predict' | 'observe' | 'explain', readonly ReactionMiss[]> = {
  predict: ['no_change', 'chemical_physical_swap', 'true_false_flipped', 'other_choice'],
  observe: ['chemical_physical_swap', 'no_change', 'true_false_flipped', 'other_choice'],
  explain: ['unbalanced_equation', 'chemical_physical_swap', 'true_false_flipped', 'no_change', 'other_choice'],
};

const TAP = 'may instead tap a choice and press Check Answer';
const MIX_FIRST = `presses Mix Substances! to run the reaction before the first question after the predictions opens, and ${TAP}`;

export const reactionLabCard = defineCard<ReactionMiss>({
  id: 'reaction-lab',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
  modes: {
    predict: { ...SAY_OR_SHOW, moves: TAP, misses: REACTION_MISSES.predict },
    observe: { ...SAY_OR_SHOW, moves: MIX_FIRST, misses: REACTION_MISSES.observe },
    explain: { ...SAY_OR_SHOW, moves: MIX_FIRST, misses: REACTION_MISSES.explain },
  },
  words: {
    job: 'run a chemistry experiment and answer one question at a time about it: what will happen before the '
      + 'substances are mixed, what the reaction showed, whether the change is chemical or physical, or why it happened',
    answer: 'their choice',
    question: 'the ask and the choices',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
