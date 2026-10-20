/**
 * stoichiometry-lab's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `stoichiometryLab.boss.ts`.
 * Which-runs-out-first asks for one choice from a closed list the ask says in full, and how-much-forms for one number:
 * the learner says it (the tutor judges the words against the key) or taps or types it and presses Check Answer (the
 * activity judges it), so both are SAY_OR_SHOW. The conversion chain places several factor cards in order and checks
 * them together, a board the activity checks (convert).
 */
import type { StoichiometryMiss, StoichMode } from './stoichiometryLabWorkspace';
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** What a wrong answer shows (`convertMiss`, `limitingMiss`, `yieldMiss`), by mode; the same ids name a spoken
 *  answer's known misses (`stoichSpokenMisses`). */
export const STOICH_MISSES: Record<StoichMode, readonly StoichiometryMiss[]> = {
  convert: ['stopped_short', 'extra_step', 'upside_down_molar_mass', 'upside_down_ratio', 'skipped_ratio', 'out_of_order', 'other_substance', 'wrong_card'],
  limiting: ['fewer_moles', 'smaller_mass', 'missed_both', 'said_both', 'other_reactant'],
  yield: ['from_excess', 'skipped_ratio', 'upside_down_ratio', 'mass_sum', 'other_amount'],
};

export const stoichiometryLabCard = defineCard<StoichiometryMiss>({
  id: 'stoichiometry-lab',
  grades: ['Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
  modes: {
    convert: { answer: 'tap', judge: 'activity', flow: 'board',
      moves: 'taps conversion-factor cards into the chain in order, then presses Check chain', misses: STOICH_MISSES.convert },
    limiting: { ...SAY_OR_SHOW, moves: 'may instead tap a choice and press Check Answer', misses: STOICH_MISSES.limiting },
    yield: { ...SAY_OR_SHOW, moves: 'may instead type the grams and press Check Answer', misses: STOICH_MISSES.yield },
  },
  words: {
    job: 'turn a mass into moles or grams with a chain of conversion factors, find the reactant that runs out first, '
      + 'or work out how many grams of a product can form',
    answer: 'their answer',
    question: 'the ask and the equation',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
