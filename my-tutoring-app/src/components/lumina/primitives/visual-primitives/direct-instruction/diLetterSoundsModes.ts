import {
  buildDiModePlan,
  challengeTypeDocsFromDiModes,
  defineDiMode,
  defineDiModes,
  evalModeDefinitionsFromDiModes,
  type DiModeItem,
} from '../../../hooks/diModeContract';

export type DiLetterSoundChallengeType =
  | 'letter_sound'
  | 'letter_sound_review'
  | 'first_sound_in_word';

export interface LetterSoundModePlanItem extends DiModeItem {
  challengeType: DiLetterSoundChallengeType;
  keyword: string;
  elicitation: 'isolated' | 'keyword';
}

const instructionFor = (item: LetterSoundModePlanItem): string =>
  item.challengeType === 'first_sound_in_word'
    ? `Your turn. What is the first sound in ${item.keyword}?`
    : item.elicitation === 'keyword'
      ? `Your turn. Say ${item.keyword}.`
      : 'Your turn. What sound?';

const mode = defineDiMode<LetterSoundModePlanItem>();
const step = {
  id: 'answer',
  actionId: (item: LetterSoundModePlanItem) => `${item.id}-say`,
  label: (item: LetterSoundModePlanItem) => item.challengeType === 'first_sound_in_word'
    ? 'Say the first sound'
    : 'Say the sound',
  icon: '🔤',
  answerKind: 'voice' as const,
  instruction: instructionFor,
  checkingInstruction: 'Listening to your sound.',
};

export const DI_LETTER_SOUNDS_MODES = defineDiModes<LetterSoundModePlanItem>(
  mode({
    evalMode: 'letter_sound', label: 'Letter Sound (Isolated)', beta: 1.5, scaffoldingMode: 1,
    challengeTypes: ['letter_sound'],
    description: 'See a letter, say its continuous sound (grapheme→phoneme). The base skill, taught as a focused cluster.',
    challengeDocs: { letter_sound: {
      promptDoc: '"letter_sound": the child sees a letter and says its continuous SOUND (grapheme→phoneme). The base skill.',
      schemaDescription: "'letter_sound' (say the letter's sound)",
    } },
    responseClass: 'continuant_sound', answerStepId: 'answer',
    groupingKey: (item) => item.challengeType, steps: [step],
  }),
  mode({
    evalMode: 'letter_sound_review', label: 'Sound Review (Mixed Set)', beta: 2.5, scaffoldingMode: 2,
    challengeTypes: ['letter_sound_review'],
    description: 'Cumulative / spaced review — re-produce already-taught sounds drawn as a wide mix across many letters, not one set.',
    challengeDocs: { letter_sound_review: {
      promptDoc: '"letter_sound_review": cumulative / spaced review — the child re-produces sounds already taught, drawn as a WIDE mix across many letters rather than one focused set.',
      schemaDescription: "'letter_sound_review' (mixed spaced review)",
    } },
    responseClass: 'continuant_sound', answerStepId: 'answer',
    groupingKey: (item) => item.challengeType, steps: [step],
  }),
  mode({
    evalMode: 'first_sound_in_word', label: 'First Sound in a Word', beta: 3.5, scaffoldingMode: 3,
    challengeTypes: ['first_sound_in_word'],
    description: 'Onset isolation (phonemic awareness): hear a whole word and say its first sound. Continuant onsets only.',
    challengeDocs: { first_sound_in_word: {
      promptDoc: '"first_sound_in_word": phonemic awareness — the child hears a whole WORD and says its FIRST sound. Continuant onsets only.',
      schemaDescription: "'first_sound_in_word' (onset isolation)",
    } },
    responseClass: 'continuant_sound', answerStepId: 'answer',
    groupingKey: (item) => item.challengeType, steps: [step],
  }),
);

export const DI_LETTER_SOUNDS_EVAL_MODES = evalModeDefinitionsFromDiModes(DI_LETTER_SOUNDS_MODES);
export const DI_LETTER_SOUNDS_TYPE_DOCS = challengeTypeDocsFromDiModes(DI_LETTER_SOUNDS_MODES);
export const DI_LETTER_SOUNDS_CHALLENGE_TYPES = DI_LETTER_SOUNDS_MODES.flatMap(
  (definition) => definition.challengeTypes,
) as DiLetterSoundChallengeType[];
export const diLetterSoundModePlan = (item: LetterSoundModePlanItem) =>
  buildDiModePlan(DI_LETTER_SOUNDS_MODES, item);
