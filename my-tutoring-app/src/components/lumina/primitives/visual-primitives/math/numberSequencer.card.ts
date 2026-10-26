/**
 * number-sequencer's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `numberSequencer.boss.ts`.
 * Five modes are one spoken number the tutor judges against the key (the glowing car, the next number counting, the
 * printed number that breaks the count). order_cards is answered with the hands: the learner puts every card on the
 * train, and the train checks the arrangement itself once the last card is placed.
 */
import type { OrderMiss, SpokenSequencerMiss } from './numberSequencerDomain';
import { defineCard, OFF_BY, SPOKEN, SPOKEN_AUDIO, TAP_ONE } from '../../../components/live-activity/boss';

export type NumberSequencerMiss = OrderMiss | SpokenSequencerMiss;

const SOUND_ALIKE = ['teen_ty_swap', 'decade_word'] as const;
const GAP_MISSES = ['said_neighbor', 'counted_by_one', ...SOUND_ALIKE, ...OFF_BY] as const satisfies readonly SpokenSequencerMiss[];

/** Each mode's misses: the train's own check of an arrangement (`orderMiss`), and the spoken modes' known wrong numbers
 *  (`numberSequencerSpokenMisses`). */
export const SEQUENCER_MISSES = {
  count_from: ['said_start', 'wrong_direction', 'skipped_one', ...SOUND_ALIKE],
  before_after: ['said_shown', 'wrong_side', 'skipped_one', ...SOUND_ALIKE],
  spot_error: ['said_repair', 'said_neighbor'],
  order_cards: ['reversed', 'two_swapped', 'other_order'],
  fill_missing: GAP_MISSES,
  decade_fill: GAP_MISSES,
} as const satisfies Record<string, readonly NumberSequencerMiss[]>;

export const numberSequencerCard = defineCard<NumberSequencerMiss>({
  id: 'number-sequencer',
  grades: ['Kindergarten', 'Grade 1'],
  modes: {
    count_from: { ...SPOKEN, misses: SEQUENCER_MISSES.count_from },
    before_after: { ...SPOKEN, misses: SEQUENCER_MISSES.before_after },
    spot_error: { ...SPOKEN, misses: SEQUENCER_MISSES.spot_error },
    order_cards: { ...TAP_ONE,
      moves: 'taps each card onto the train, smallest first; the train checks the order once the last card is placed',
      misses: SEQUENCER_MISSES.order_cards },
    fill_missing: { ...SPOKEN, misses: SEQUENCER_MISSES.fill_missing },
    decade_fill: { ...SPOKEN, misses: SEQUENCER_MISSES.decade_fill },
  },
  words: {
    job: 'say the number that belongs in the glowing car, the next number counting, or the printed number that breaks '
      + 'the count, or put number cards on the train from smallest to largest',
    answer: 'the number',
    question: 'the ask and the numbers printed on the train',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
