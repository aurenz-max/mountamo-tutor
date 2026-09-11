import {
  buildDiModePlan, challengeTypeDocsFromDiModes, defineDiMode, defineDiModes,
  evalModeDefinitionsFromDiModes, type DiModeItem,
} from '../../../hooks/diModeContract';

export type DiSentenceReadingChallengeType =
  | 'decodable_sentence' | 'read_sentence' | 'sentence_review' | 'sight_phrase_sentence';
export interface SentenceReadingModePlanItem extends DiModeItem {
  challengeType: DiSentenceReadingChallengeType;
}

const mode = defineDiMode<SentenceReadingModePlanItem>();
const step = {
  id: 'answer', actionId: (item: SentenceReadingModePlanItem) => `${item.id}-read`,
  label: 'Read the sentence', icon: '📖', answerKind: 'voice' as const,
  instruction: 'Your turn. Read it.', checkingInstruction: 'Listening to your sentence.',
};

export const DI_SENTENCE_READING_MODES = defineDiModes<SentenceReadingModePlanItem>(
  mode({
    evalMode: 'decodable_sentence', label: 'Sound-It-Out Sentence', beta: 2.5, scaffoldingMode: 2,
    challengeTypes: ['decodable_sentence'],
    description: 'Read a sentence in which every content word is a sound-it-out CVC word — blending carried from single words into connected text. Phonics transfer, no irregular words to recall.',
    challengeDocs: { decodable_sentence: {
      promptDoc: '"decodable_sentence": the child reads a printed short sentence in which EVERY content word is a sound-it-out CVC word ("The pig can dig."). The skill is blending carried from single words into connected text — phonics transfer, not sight recall.',
      schemaDescription: "'decodable_sentence' (read a fully sound-it-out sentence)",
    } }, responseClass: 'sentence_read_aloud', answerStepId: 'answer', groupingKey: (i) => i.challengeType, steps: [step],
  }),
  mode({
    evalMode: 'read_sentence', label: 'Read a Sentence', beta: 3.0, scaffoldingMode: 3,
    challengeTypes: ['read_sentence'],
    description: 'See one printed short sentence, read it aloud — every word, in order. Modeled and read together first, then read alone and judged for accuracy. The base skill over mixed vocabulary.',
    challengeDocs: { read_sentence: {
      promptDoc: '"read_sentence": the child sees ONE printed short sentence (3-8 words) and reads it aloud, every word in order. The tutor judges reading ACCURACY from the audio. The base connected-text skill, one rung above single-word reading.',
      schemaDescription: "'read_sentence' (read the printed sentence aloud)",
    } }, responseClass: 'sentence_read_aloud', answerStepId: 'answer', groupingKey: (i) => i.challengeType, steps: [step],
  }),
  mode({
    evalMode: 'sentence_review', label: 'Sentence Review (Mixed Set)', beta: 3.5, scaffoldingMode: 3,
    challengeTypes: ['sentence_review'],
    description: 'Cumulative / spaced review — re-read sentences of the kind already taught, drawn as a wide mix across every vowel pattern and word type rather than one focused set.',
    challengeDocs: { sentence_review: {
      promptDoc: '"sentence_review": cumulative / spaced review — the child re-reads sentences of the kind already taught, drawn as a WIDE mix across every vowel pattern and word type rather than one focused set. The skill is retention and flexible retrieval, not first-time decoding.',
      schemaDescription: "'sentence_review' (mixed cumulative review)",
    } }, responseClass: 'sentence_read_aloud', answerStepId: 'answer', groupingKey: (i) => i.challengeType, steps: [step],
  }),
  mode({
    evalMode: 'sight_phrase_sentence', label: 'Sight-Word Sentence', beta: 4.0, scaffoldingMode: 4,
    challengeTypes: ['sight_phrase_sentence'],
    description: 'Read a sentence carrying several irregular high-frequency words ("You can see my dog.") — words that cannot be sounded out and must be recognised whole inside connected text.',
    challengeDocs: { sight_phrase_sentence: {
      promptDoc: '"sight_phrase_sentence": the child reads a printed short sentence carrying several IRREGULAR high-frequency words ("You can see my dog.") — words that cannot be sounded out and must be recognised whole. The skill is instant sight-word recall inside connected text.',
      schemaDescription: "'sight_phrase_sentence' (read a sight-word-dense sentence)",
    } }, responseClass: 'sentence_read_aloud', answerStepId: 'answer', groupingKey: (i) => i.challengeType, steps: [step],
  }),
);

export const DI_SENTENCE_READING_EVAL_MODES = evalModeDefinitionsFromDiModes(DI_SENTENCE_READING_MODES);
export const DI_SENTENCE_READING_TYPE_DOCS = challengeTypeDocsFromDiModes(DI_SENTENCE_READING_MODES);
export const DI_SENTENCE_READING_CHALLENGE_TYPES = DI_SENTENCE_READING_MODES.flatMap(
  (definition) => definition.challengeTypes,
) as DiSentenceReadingChallengeType[];
export const diSentenceReadingModePlan = (item: SentenceReadingModePlanItem) =>
  buildDiModePlan(DI_SENTENCE_READING_MODES, item);
