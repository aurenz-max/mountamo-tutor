/**
 * life-cycle-sequencer's card: how its one mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `lifeCycleSequencer.boss.ts`.
 * The payload is one sequence: the learner fills every numbered slot from a mixed-up bank of picture cards and checks
 * the order as a whole, so the activity checks it (a board).
 */
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong order shows (`cycleMiss`, `TeachingAttempt.miss`, handoff 20), read from the placed order alone:
 * - `cycle_rotated`: a circle, every stage followed by the right next one, but started from another stage;
 * - `reversed`: last to first, every stage mirrored;
 * - `adjacent_swap`: two neighbouring stages traded places, the rest right;
 * - `two_swapped`: two stages further apart traded places, the rest right;
 * - `one_moved`: one stage put in the wrong place, the others in the right order around it;
 * - `mixed_order`: anything else.
 */
export type CycleMiss = 'cycle_rotated' | 'reversed' | 'adjacent_swap' | 'two_swapped' | 'one_moved' | 'mixed_order';
export const CYCLE_MISSES: readonly CycleMiss[] = ['cycle_rotated', 'reversed', 'adjacent_swap', 'two_swapped', 'one_moved', 'mixed_order'];

export const lifeCycleSequencerCard = defineCard<CycleMiss>({
  id: 'life-cycle-sequencer',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
  modes: {
    sequence: {
      answer: 'manipulate', judge: 'activity', flow: 'board',
      moves: 'taps a card, then a numbered slot to place it, or drags it there (from Kindergarten to Grade 2 a tap on a '
        + 'picture puts it in the next empty slot); tapping a placed card takes it back out; with every slot filled '
        + 'presses Check Answer',
      misses: CYCLE_MISSES,
      // Which stage a circle starts from is the item's own choice; a lever that showed it would place a stage.
      unanswered: ['cycle_rotated'],
    },
  },
  words: {
    job: 'put the stages of a life cycle or a biological process in the order they really happen, from slot 1 on: a '
      + 'life with a beginning and an end, or a cycle that starts again',
    answer: 'the order of the stages',
    question: 'the instruction, the title and the picture cards',
  },
  levers: true,
});
