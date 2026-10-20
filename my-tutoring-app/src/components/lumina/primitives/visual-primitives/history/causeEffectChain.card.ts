/**
 * cause-effect-chain's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `causeEffectChain.boss.ts`.
 * Find the causes is one spoken yes or no about one event; root or right before is one spoken pick of an event card;
 * build the chain is the cards tapped into the slots in causal order, a board the activity checks once it is full and
 * still.
 */
import { defineCard, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/**
 * What a wrong answer shows (`TeachingAttempt.miss`), by mode (handoff 20).
 * - build_chain (`chainMiss`, the board's own check): `reversed` (the order run backwards), `two_swapped` (only two
 *   cards out of place), `other_order`.
 * - identify_cause (`causeEffectSpokenMisses`, by the event's role): `cause_denied` (a real cause said not to help),
 *   `consequence_as_cause` (an event that came after the ending said to cause it), `background_as_cause` (a fact only
 *   true at the time said to cause it).
 * - root_vs_proximate (`causeEffectSpokenMisses`, by where the named card sits): `other_end` (the event at the other
 *   end of the chain, the signature miss), `middle_event`.
 */
export const CHAIN_MISSES = {
  identify_cause: ['cause_denied', 'consequence_as_cause', 'background_as_cause'],
  build_chain: ['reversed', 'two_swapped', 'other_order'],
  root_vs_proximate: ['other_end', 'middle_event'],
} as const;
type Misses = typeof CHAIN_MISSES;
export type ChainMiss = Misses['build_chain'][number];
export type SpokenChainMiss = Misses['identify_cause' | 'root_vs_proximate'][number];

export const causeEffectChainCard = defineCard<ChainMiss | SpokenChainMiss>({
  id: 'cause-effect-chain',
  grades: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
  modes: {
    identify_cause: { ...SPOKEN, misses: CHAIN_MISSES.identify_cause },
    build_chain: { answer: 'build', judge: 'activity', flow: 'board',
      moves: 'taps each event card into the next empty slot, earliest first (a tap on a placed card takes it back out); '
        + 'the chain is checked once every slot is filled and the board sits still',
      misses: CHAIN_MISSES.build_chain },
    root_vs_proximate: { ...SPOKEN, misses: CHAIN_MISSES.root_vs_proximate },
  },
  words: {
    job: 'work out what led to an ending in history: say whether one event helped cause it, put the event cards in the '
      + 'order each made the next possible, or say which event is the root or the one right before the ending',
    answer: 'the learner\'s answer',
    question: 'the ending and the events',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
