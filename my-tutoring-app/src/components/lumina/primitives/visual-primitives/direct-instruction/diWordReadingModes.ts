import {
  buildDiModePlan, challengeTypeDocsFromDiModes, defineDiMode, defineDiModes,
  evalModeDefinitionsFromDiModes, type DiModeItem,
} from '../../../hooks/diModeContract';

export type DiWordReadingChallengeType =
  | 'cvc_reading' | 'read_word' | 'sight_word' | 'word_reading_review';

export interface WordReadingModePlanItem extends DiModeItem {
  challengeType: DiWordReadingChallengeType;
}

const mode = defineDiMode<WordReadingModePlanItem>();
const step = {
  id: 'answer',
  actionId: (item: WordReadingModePlanItem) => `${item.id}-read`,
  label: 'Read the word', icon: '📖', answerKind: 'voice' as const,
  instruction: 'Your turn. What word?', checkingInstruction: 'Listening to your word.',
};

export const DI_WORD_READING_MODES = defineDiModes<WordReadingModePlanItem>(
  mode({
    evalMode: 'cvc_reading', label: 'Read a CVC Word', beta: 2.0, scaffoldingMode: 1,
    challengeTypes: ['cvc_reading'],
    description: 'Blend and read one decodable short-vowel CVC word; a named vowel pattern binds the whole set.',
    challengeDocs: { cvc_reading: {
      promptDoc: '"cvc_reading": the child blends and reads ONE decodable short-vowel CVC word. Every item is CVC; a named short-vowel scope remains binding.',
      schemaDescription: "'cvc_reading' (blend and read a decodable CVC word)",
    } },
    responseClass: 'short_spoken_word', answerStepId: 'answer',
    groupingKey: (item) => item.challengeType, steps: [step],
  }),
  mode({
    evalMode: 'read_word', label: 'Read a Word', beta: 2.5, scaffoldingMode: 1,
    challengeTypes: ['read_word'],
    description: 'See one printed word, read it aloud — blend-and-read for decodable CVC words, whole-word recall for sight words.',
    challengeDocs: { read_word: {
      promptDoc: '"read_word": the child sees ONE printed word and reads it aloud — blend-and-read for a decodable CVC word, whole-word recall for a sight word. The base skill.',
      schemaDescription: "'read_word' (read the printed word aloud)",
    } },
    responseClass: 'short_spoken_word', answerStepId: 'answer',
    groupingKey: (item) => item.challengeType, steps: [step],
  }),
  mode({
    evalMode: 'sight_word', label: 'Read a Sight Word', beta: 3.0, scaffoldingMode: 2,
    challengeTypes: ['sight_word'],
    description: 'Recall and read one irregular high-frequency word as a whole, without sounding it out.',
    challengeDocs: { sight_word: {
      promptDoc: '"sight_word": the child recalls and reads ONE irregular high-frequency word as a whole. Never sound it out; every item comes from the sight-word set.',
      schemaDescription: "'sight_word' (recall an irregular high-frequency word)",
    } },
    responseClass: 'short_spoken_word', answerStepId: 'answer',
    groupingKey: (item) => item.challengeType, steps: [step],
  }),
  mode({
    evalMode: 'word_reading_review', label: 'Word Reading Review', beta: 3.5, scaffoldingMode: 2,
    challengeTypes: ['word_reading_review'],
    description: 'Cumulative spaced review across taught short-vowel CVC families and irregular sight words.',
    challengeDocs: { word_reading_review: {
      promptDoc: '"word_reading_review": cumulative spaced review across taught CVC vowel families and sight words, anchored on the objective focus but never collapsed to one narrow set.',
      schemaDescription: "'word_reading_review' (mixed cumulative word review)",
    } },
    responseClass: 'short_spoken_word', answerStepId: 'answer',
    groupingKey: (item) => item.challengeType, steps: [step],
  }),
);

export const DI_WORD_READING_EVAL_MODES = evalModeDefinitionsFromDiModes(DI_WORD_READING_MODES);
export const DI_WORD_READING_TYPE_DOCS = challengeTypeDocsFromDiModes(DI_WORD_READING_MODES);
export const DI_WORD_READING_CHALLENGE_TYPES = DI_WORD_READING_MODES.flatMap(
  (definition) => definition.challengeTypes,
) as DiWordReadingChallengeType[];
export const diWordReadingModePlan = (item: WordReadingModePlanItem) =>
  buildDiModePlan(DI_WORD_READING_MODES, item);
