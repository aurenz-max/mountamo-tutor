/**
 * context-clues-detective's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `contextClues.boss.ts`.
 * Each word is checked steps, the items of the lesson, and the item's kind names its step: `find` (tap the clue
 * sentences, checked together), `classify` (tap one of five clue types; built only when the lesson mixes clue types,
 * so only synonym_antonym has it) and `define` (tap one printed meaning). The activity checks every step.
 */
import { defineCard, TAP_ONE } from '../../../components/live-activity/boss';

/**
 * What a wrong check shows (`clueMiss`, `TeachingAttempt.miss`, handoff 20), only the observable pattern:
 * - find: `target_sentence_only` (only the sentence that holds the word, when the clue is elsewhere), `extra_sentence`
 *   (a clue sentence plus one that is not), `no_clue` (no clue sentence to find tapped);
 * - classify: `similar_opposite` (synonym and antonym swapped), `definition_synonym` (definition and synonym
 *   swapped), `said_inference` (inference for a clue the text states), `stated_for_inference` (a stated type for
 *   an inference clue), `other_type`;
 * - define: `other_meaning` (another option, or a typed meaning the item does not accept).
 */
export type ContextClueMiss = 'target_sentence_only' | 'extra_sentence' | 'no_clue'
  | 'similar_opposite' | 'definition_synonym' | 'said_inference' | 'stated_for_inference' | 'other_type'
  | 'other_meaning';

export const FIND_MISSES: readonly ContextClueMiss[] = ['target_sentence_only', 'extra_sentence', 'no_clue'];
/** The miss list per eval mode: what `clueMiss` can name on that mode's clue types. */
export const CONTEXT_CLUE_MISSES_BY_MODE: Readonly<Record<string, readonly ContextClueMiss[]>> = {
  // One clue type per session: no classify step (`cluePhases`), so no type misses.
  definition: [...FIND_MISSES, 'other_meaning'],
  // Synonym and antonym words mixed: the classify step is built.
  synonym_antonym: [...FIND_MISSES, 'similar_opposite', 'definition_synonym', 'said_inference', 'other_type', 'other_meaning'],
  example: [...FIND_MISSES, 'other_meaning'],
  inference: [...FIND_MISSES, 'other_meaning'],
};

/** The steps, keyed by the step name the scene publishes as `kind`. find is a board: the tapped sentences are
 *  checked together, so the tutor never points at one sentence before the check. */
const STEPS = {
  find: { answer: 'tap', judge: 'activity', flow: 'board',
    moves: 'taps each sentence that gives a clue to the word (a second tap lifts one), then presses Check Clue' },
  classify: { ...TAP_ONE, moves: 'taps one of the five clue types, then presses Check Type' },
  define: { ...TAP_ONE, moves: 'taps one printed meaning, then presses Check Meaning' },
} as const;
const ONE_TYPE = { find: STEPS.find, define: STEPS.define };

export const contextCluesCard = defineCard<ContextClueMiss>({
  id: 'context-clues-detective',
  grades: ['Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
  // Every step publishes help levers (`contextCluesLevers.ts`); every miss is answered by a lever on its step.
  modes: {
    definition: { steps: ONE_TYPE, misses: CONTEXT_CLUE_MISSES_BY_MODE.definition },
    synonym_antonym: { steps: STEPS, misses: CONTEXT_CLUE_MISSES_BY_MODE.synonym_antonym },
    example: { steps: ONE_TYPE, misses: CONTEXT_CLUE_MISSES_BY_MODE.example },
    inference: { steps: ONE_TYPE, misses: CONTEXT_CLUE_MISSES_BY_MODE.inference },
  },
  words: {
    job: 'work out what a mystery word means from clues in its passage: find the sentences that give a clue, name the '
      + 'kind of clue when the lesson mixes clue types, and pick the meaning',
    answer: 'the learner\'s taps',
    question: 'the passage, the mystery word, the five clue-type names and the printed meanings',
  },
  levers: true,
});
