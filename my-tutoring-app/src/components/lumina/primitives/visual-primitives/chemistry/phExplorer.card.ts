/**
 * ph-explorer's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `phExplorer.boss.ts`.
 * Every item is one closed choice keyed in code from the substances' pH values (acid, base or neutral; a pH range; an
 * amount of base): the learner says it (the tutor judges the words against the key) or taps it and checks it (the
 * activity judges the tap), so every mode is SAY_OR_SHOW.
 */
import type { PhExplorerMiss, PhMode } from './phExplorerWorkspace';
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** What a wrong choice shows (`phMiss`), by mode; the same ids name each spoken item's known misses. */
export const PH_MISSES: Record<PhMode, readonly PhExplorerMiss[]> = {
  test: ['acid_base_swapped', 'said_neutral', 'missed_neutral'],
  indicator: ['other_side', 'next_band', 'far_band'],
  neutralize: ['equal_amounts', 'too_little', 'too_much'],
};

export const phExplorerCard = defineCard<PhExplorerMiss>({
  id: 'ph-explorer',
  grades: ['Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
  modes: {
    test: { ...SAY_OR_SHOW, moves: 'presses Dip the litmus papers to see the papers change, and may instead tap Acid, Base or Neutral and press Check Answer',
      misses: PH_MISSES.test },
    indicator: { ...SAY_OR_SHOW, moves: 'may instead tap a pH range and press Check Answer', misses: PH_MISSES.indicator },
    neutralize: { ...SAY_OR_SHOW, moves: 'may instead tap an amount and press Mix and check', misses: PH_MISSES.neutralize },
  },
  words: {
    job: 'read substances on the pH scale and answer one question at a time: whether a substance is an acid, a base or '
      + 'neutral from two litmus papers, which pH range a red cabbage juice colour shows, or how many cups of a strong '
      + 'base make 1 cup of a strong acid neutral',
    answer: 'their choice',
    question: 'the ask and the choices',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
