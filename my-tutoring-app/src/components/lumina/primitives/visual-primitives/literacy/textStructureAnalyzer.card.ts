/**
 * text-structure-analyzer's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `textStructureAnalyzer.boss.ts`.
 * Every item is one spoken answer (the linking word of a numbered sentence, how the passage is organised, or the part
 * an idea belongs in) the tutor judges against the key, so the boss is the spoken preset.
 */
import type { SpokenTextStructureMiss } from './textStructureAnalyzerDomain';
import { defineCard, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** Every mode runs all three actions over its passage, so every mode names every miss (`textStructureSpokenMisses`). */
const MISSES: readonly SpokenTextStructureMiss[] = ['content_word', 'not_in_sentence', 'other_structure', 'said_topic',
  'said_signal_word', 'other_part', 'said_idea_back'];

export const textStructureAnalyzerCard = defineCard<SpokenTextStructureMiss>({
  id: 'text-structure-analyzer',
  grades: ['Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
  modes: {
    chronological_description: { ...SPOKEN, misses: MISSES },
    cause_effect: { ...SPOKEN, misses: MISSES },
    compare_contrast: { ...SPOKEN, misses: MISSES },
    problem_solution: { ...SPOKEN, misses: MISSES },
  },
  words: {
    job: 'read a printed passage and say the linking word of a numbered sentence, how the whole passage is organised '
      + 'from the printed menu, or which labelled part an idea belongs in',
    answer: 'the spoken answer',
    question: 'the ask and the idea card',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
