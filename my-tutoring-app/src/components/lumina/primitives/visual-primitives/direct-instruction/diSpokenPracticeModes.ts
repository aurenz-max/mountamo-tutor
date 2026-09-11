import type { ResponseClassId } from '../../../hooks/judgedScriptContract';
import {
  buildDiModePlan,
  challengeTypeDocsFromDiModes,
  defineDiMode,
  defineDiModes,
  evalModeDefinitionsFromDiModes,
  type DiModeItem,
} from '../../../hooks/diModeContract';

export type SpokenPracticeMode =
  | 'count_and_say'
  | 'compare_choice'
  | 'read_aloud'
  | 'say_answer'
  | 'explain_concept';

export type StimulusKind = 'text' | 'emoji' | 'objects' | 'none' | 'pair';
export type AnswerSource = 'recall' | 'decode';

interface SpokenPracticeModeMetadata {
  stimulusKind: StimulusKind;
  answerSource: AnswerSource;
  howToPlay: string;
}

interface SpokenPracticeContractItem extends DiModeItem {
  challengeType: SpokenPracticeMode;
  ask: string;
  responseClass: ResponseClassId;
}

export interface SpokenPracticeModePlanItem {
  id: string;
  mode: SpokenPracticeMode;
  ask: string;
  responseClass: ResponseClassId;
}

const mode = defineDiMode<SpokenPracticeContractItem, SpokenPracticeModeMetadata>();

export const DI_SPOKEN_PRACTICE_MODES = defineDiModes<
  SpokenPracticeContractItem,
  SpokenPracticeModeMetadata
>(
  mode({
    evalMode: 'count_and_say',
    label: 'Count and Say',
    beta: 1.5,
    scaffoldingMode: 1,
    challengeTypes: ['count_and_say'],
    description: 'A group of pictures is on screen; the child counts them and says how many. No numeral is ever printed.',
    challengeDocs: {
      count_and_say: {
        promptDoc:
          '"count_and_say": a group of identical pictures is on screen and the child says HOW MANY. '
          + 'The numeral is never printed.',
        schemaDescription: "'count_and_say' (say how many)",
      },
    },
    responseClass: (item) => item.responseClass,
    answerStepId: 'answer',
    groupingKey: (item) => item.challengeType,
    metadata: {
      stimulusKind: 'objects',
      answerSource: 'recall',
      howToPlay: 'Count the pictures, then say how many out loud.',
    },
    steps: [{
      id: 'answer',
      actionId: (item) => item.challengeType,
      label: 'Count and Say',
      icon: '123',
      answerKind: 'voice',
      instruction: (item) => item.ask,
      checkingInstruction: 'Listening to your answer.',
    }],
  }),
  mode({
    evalMode: 'compare_choice',
    label: 'Which Word?',
    beta: 2.0,
    scaffoldingMode: 2,
    challengeTypes: ['compare_choice'],
    description: 'Two things are shown side by side and the child SAYS which word from a set the objective names (longer/shorter, heavier/lighter, more/fewer) describes them. Use when the objective enumerates the comparison words the child must produce. The tutor reads the whole word menu on every item.',
    challengeDocs: {
      compare_choice: {
        promptDoc:
          '"compare_choice": TWO things are on screen and the child says which word from a fixed, '
          + 'stated set describes them (longer/shorter, heavier/lighter). The tutor reads the WHOLE '
          + 'word menu on every item, so the menu is not a hint — knowing which word fits the pair is '
          + 'the skill. Use it when the objective names the words the child must produce.',
        schemaDescription: "'compare_choice' (say which word describes a pair)",
      },
    },
    responseClass: (item) => item.responseClass,
    answerStepId: 'answer',
    groupingKey: (item) => item.challengeType,
    metadata: {
      stimulusKind: 'pair',
      answerSource: 'recall',
      howToPlay: 'I will show you two things and say the words, and you say the one that fits.',
    },
    steps: [{
      id: 'answer',
      actionId: (item) => item.challengeType,
      label: 'Which Word?',
      icon: '<>',
      answerKind: 'voice',
      instruction: (item) => item.ask,
      checkingInstruction: 'Listening to your answer.',
    }],
  }),
  mode({
    evalMode: 'read_aloud',
    label: 'Read It Aloud',
    beta: 2.5,
    scaffoldingMode: 2,
    challengeTypes: ['read_aloud'],
    description: 'Decode printed words or numerals aloud. Naming a displayed symbol or picture is recall: use say_answer. The printed text itself is the utterance.',
    challengeDocs: {
      read_aloud: {
        promptDoc:
          '"read_aloud": the printed stimulus IS the utterance — the child reads it aloud. '
          + 'Decoding, not recall; the thing on screen is the task, not a leak.',
        schemaDescription: "'read_aloud' (read the printed stimulus aloud)",
      },
    },
    responseClass: (item) => item.responseClass,
    answerStepId: 'answer',
    groupingKey: (item) => item.challengeType,
    metadata: {
      stimulusKind: 'text',
      answerSource: 'decode',
      howToPlay: 'I will show you a word, and you read it out loud.',
    },
    steps: [{
      id: 'answer',
      actionId: (item) => item.challengeType,
      label: 'Read It Aloud',
      icon: 'Aa',
      answerKind: 'voice',
      instruction: (item) => item.ask,
      checkingInstruction: 'Listening to your reading.',
    }],
  }),
  mode({
    evalMode: 'say_answer',
    label: 'Say the Answer',
    beta: 3.0,
    scaffoldingMode: 3,
    challengeTypes: ['say_answer'],
    description: 'Name a displayed symbol or picture, or answer a spoken problem. Recall, not decoding. Show visual naming targets without speaking their names or printing answers.',
    challengeDocs: {
      say_answer: {
        promptDoc:
          '"say_answer": the child meets a stimulus (a printed fact, a word said aloud, a picture) '
          + 'and SAYS an answer they were not shown. Includes naming a displayed symbol/picture: '
          + 'the visual is the question and its name must NOT be spoken before the child answers.',
        schemaDescription: "'say_answer' (produce a spoken answer)",
      },
    },
    responseClass: (item) => item.responseClass,
    answerStepId: 'answer',
    groupingKey: (item) => item.challengeType,
    metadata: {
      stimulusKind: 'text',
      answerSource: 'recall',
      howToPlay: 'I will ask, and you say the answer out loud.',
    },
    steps: [{
      id: 'answer',
      actionId: (item) => item.challengeType,
      label: 'Say the Answer',
      icon: 'A',
      answerKind: 'voice',
      instruction: (item) => item.ask,
      checkingInstruction: 'Listening to your answer.',
    }],
  }),
  mode({
    evalMode: 'explain_concept',
    label: 'Say Why',
    beta: 4.0,
    scaffoldingMode: 4,
    challengeTypes: ['explain_concept'],
    description: 'The child sees one instance (an equation on a balance, a pattern, a ten rod) and says in their own words what it means or what rule it follows. Use for explain / describe / tell-why objectives whose answer is a short idea with many correct wordings. Judged on meaning; the ask never states the concept.',
    challengeDocs: {
      explain_concept: {
        promptDoc:
          '"explain_concept": the child sees ONE instance (an equation, a pattern, a ten rod) and says '
          + 'IN THEIR OWN WORDS what it means, why it is so, or what rule governs it. The answer is an '
          + 'IDEA with many correct wordings, judged on meaning; the ask never states the concept. Use it '
          + 'for explain / describe / tell-why objectives whose answer is a short proposition.',
        schemaDescription: "'explain_concept' (say what it means or what the rule is)",
      },
    },
    responseClass: (item) => item.responseClass,
    answerStepId: 'answer',
    groupingKey: (item) => item.challengeType,
    metadata: {
      stimulusKind: 'text',
      answerSource: 'recall',
      howToPlay: 'I will show you something, and you tell me what it means in your own words.',
    },
    steps: [{
      id: 'answer',
      actionId: (item) => item.challengeType,
      label: 'Say Why',
      icon: 'why',
      answerKind: 'voice',
      instruction: (item) => item.ask,
      checkingInstruction: 'Listening to your explanation.',
    }],
  }),
);

export const DI_SPOKEN_PRACTICE_EVAL_MODES = evalModeDefinitionsFromDiModes(
  DI_SPOKEN_PRACTICE_MODES,
);
export const DI_SPOKEN_PRACTICE_TYPE_DOCS = challengeTypeDocsFromDiModes(
  DI_SPOKEN_PRACTICE_MODES,
);
export const DI_SPOKEN_PRACTICE_CHALLENGE_TYPES = DI_SPOKEN_PRACTICE_MODES.flatMap(
  (definition) => definition.challengeTypes,
) as SpokenPracticeMode[];

export const MODE_SHAPE: Record<
  SpokenPracticeMode,
  { stimulusKind: StimulusKind; answerSource: AnswerSource; label: string }
> = Object.fromEntries(DI_SPOKEN_PRACTICE_MODES.map((definition) => [
  definition.evalMode,
  {
    stimulusKind: definition.metadata!.stimulusKind,
    answerSource: definition.metadata!.answerSource,
    label: definition.label,
  },
])) as Record<SpokenPracticeMode, {
  stimulusKind: StimulusKind;
  answerSource: AnswerSource;
  label: string;
}>;

export const HOW_TO_PLAY = Object.fromEntries(DI_SPOKEN_PRACTICE_MODES.map((definition) => [
  definition.evalMode,
  definition.metadata!.howToPlay,
])) as Record<SpokenPracticeMode, string>;

export const diSpokenPracticeModePlan = (item: SpokenPracticeModePlanItem) =>
  buildDiModePlan(DI_SPOKEN_PRACTICE_MODES, {
    id: item.id,
    challengeType: item.mode,
    ask: item.ask,
    responseClass: item.responseClass,
  });
