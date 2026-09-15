import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';
import type { WordWorkoutItemKind } from '../primitives/visual-primitives/literacy/wordWorkoutScript';

export interface WordWorkoutPipState extends PipPhaseGate {
  kind: WordWorkoutItemKind;
  /** Rendered targets: `pair` (real or silly), `word` (the printed word),
   *  `picture-<word>` (picture match), `chain-row` (the chain word the screen
   *  marks), `sentence`, `context-target` (the near word the screen marks). */
  visibleIds: string[];
  /** The picture the child tapped on this attempt (picture match). */
  lastTouchedId?: string;
}

const CUE: Record<WordWorkoutItemKind, string> = {
  real_word: 'pair',
  picture_tap: 'word',
  chain_word: 'chain-row',
  read_sentence: 'sentence',
  answer_question: 'sentence',
  read_extended_word: 'word',
  answer_word_meaning: 'word',
  read_context_word: 'context-target',
  choose_context_word: 'sentence',
};

/** Pip points only at what the ask names or the screen already marks:
 *  - real or silly: both printed words as one region; either could be the answer.
 *  - picture match: the printed word, never a picture. The tapped picture is a
 *    single committed choice, so Pip watches it while it is judged, not receives it.
 *  - chain word: the row the screen highlights; near words: the card it highlights.
 *  - sentence read, its question, and the context choice: the whole sentence,
 *    never one word of it and never a near-word card.
 *  - extended word and its meaning question: the word card.
 */
export function wordWorkoutPipPose(state: WordWorkoutPipState): PipPose {
  const cueId = CUE[state.kind];
  const attendId = state.kind === 'picture_tap' ? state.lastTouchedId ?? cueId : cueId;
  return pipPhasePose(state, { visibleIds: state.visibleIds, cueId, attendId });
}
