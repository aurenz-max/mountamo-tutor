/**
 * Dice roll's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `diDiceRoll.boss.ts`.
 * The learner rolls, then every mode is one spoken answer the tutor judges against the key.
 */
import type { SpokenDiceMiss } from './diDiceRollWorkspace';
import { defineCard, SPOKEN, SPOKEN_AUDIO, OFF_BY } from '../../../components/live-activity/boss';


export const diDiceRollCard = defineCard<SpokenDiceMiss>({
  id: 'di-dice-roll',
  grades: ['Kindergarten', 'Grade 1'],
  // Every item's known wrong answers (`diceSpokenMisses`), named by the `spoken_miss` observer.
  modes: {
    count_pips: { ...SPOKEN, misses: ['skipped_a_number', ...OFF_BY] },
    compare_dice: { ...SPOKEN, misses: ['other_die', 'said_same', 'picked_a_side', 'said_number'] },
    sum_two_dice: { ...SPOKEN, misses: ['said_addend', ...OFF_BY] },
  },
  words: {
    job: 'roll the dice, then say how many dots, which die has more (left, right, or same), or how many dots altogether',
    answer: 'the spoken answer',
    question: 'the ask',
    // Counting aloud to the answer and the strict different-number rule are each item's key; the model lever is the
    // shared doctrine's.
    special: 'The dice stay covered until the learner taps them to roll; the roll is theirs, and there is nothing to '
      + 'answer before it, so ask them to roll first. No number is printed. You cannot roll or change a die.',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
