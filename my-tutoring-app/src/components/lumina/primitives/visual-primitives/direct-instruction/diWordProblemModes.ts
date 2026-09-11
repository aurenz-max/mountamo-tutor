import {
  buildDiModePlan,
  challengeTypeDocsFromDiModes,
  defineDiMode,
  defineDiModes,
  evalModeDefinitionsFromDiModes,
  type DiModeItem,
  type DiModeStepDefinition,
} from '../../../hooks/diModeContract';
import type { WordProblemPlan } from './diWordProblemPlan';

export type WordProblemChallengeType = 'find_big_number' | 'build_family' | 'classify_and_build';
export type WordProblemSupportTier = 'easy' | 'medium' | 'hard';
export type WordProblemStepKind = 'classify' | 'big_number' | 'family' | 'operation' | 'solve';

export interface WordProblemModePlanItem extends DiModeItem {
  challengeType: WordProblemChallengeType;
  plan: WordProblemPlan;
  maxNumber: number;
}

interface WordProblemModeMetadata { howToPlay: string }

const CLASSIFY_MENU = 'a comparison problem, a change problem, or a part-whole problem';
const OPERATION_MENU = 'add or subtract';

const step = (
  definition: DiModeStepDefinition<WordProblemModePlanItem>,
): DiModeStepDefinition<WordProblemModePlanItem> => definition;

const classify = step({
  id: 'classify', actionId: 'classify', label: 'Name the story kind', icon: '?',
  answerKind: 'voice', responseClass: 'closed_set_choice',
  instruction: `Say whether this is ${CLASSIFY_MENU}.`,
  checkingInstruction: 'Listening for the story kind.',
});
const bigNumber = step({
  id: 'big_number', actionId: 'big_number',
  label: (item) => item.challengeType === 'find_big_number' ? 'Find the big amount' : 'Build the family',
  icon: '↗', answerKind: 'gesture', responseClass: 'manipulation',
  instruction: (item) => item.challengeType === 'find_big_number'
    ? 'Drag the story part that names the big amount into the big amount box.'
    : 'Drag all three story-part cards into small plus small equals big.',
  checkingInstruction: (item) => item.challengeType === 'find_big_number'
    ? 'Checking the big amount.'
    : 'Checking the family you built.',
});
const family = step({
  id: 'family', actionId: 'family', label: 'Read the family', icon: '123',
  answerKind: 'voice', responseClass: 'equation_statement',
  instruction: 'Read the number family you built out loud. Say box for the unknown amount.',
  checkingInstruction: 'Listening to the number family.',
});
const operation = step({
  id: 'operation', actionId: 'operation', label: 'Choose the operation', icon: '+−',
  answerKind: 'voice', responseClass: 'closed_set_choice',
  instruction: `Say whether you ${OPERATION_MENU}.`,
  checkingInstruction: 'Listening for add or subtract.',
});
const solve = step({
  id: 'solve', actionId: 'solve', label: 'Solve the problem', icon: '✓',
  answerKind: 'voice',
  responseClass: (item) => item.maxNumber <= 20 ? 'number_word_to_20' : 'number_word_to_120',
  instruction: (item) => `Solve it and say the answer aloud. ${item.plan.questionSpoken}`,
  checkingInstruction: 'Listening for the answer.',
});

const mode = defineDiMode<WordProblemModePlanItem, WordProblemModeMetadata>();
export const DI_WORD_PROBLEM_MODES = defineDiModes<WordProblemModePlanItem, WordProblemModeMetadata>(
  mode({
    evalMode: 'find_big_number', label: 'Find the Big Number', beta: 2.5, scaffoldingMode: 1,
    challengeTypes: ['find_big_number'],
    description: 'One-step addition or subtraction word problem: identify the whole by placing one story part in the big-amount box, then solve and say how many.',
    challengeDocs: { find_big_number: {
      promptDoc: '"find_big_number": an addition/subtraction story; the child identifies the whole by dragging one story-part card into the big-amount box, then solves and says how many. G1-2.',
      schemaDescription: "'find_big_number' (place the big amount, then work it)",
    } },
    responseClass: (item) => item.maxNumber <= 20 ? 'number_word_to_20' : 'number_word_to_120',
    answerStepId: 'solve', steps: [bigNumber, solve], groupingKey: (item) => item.challengeType,
    metadata: { howToPlay: 'We are going to set up word problems. First, listen to the story. Next, drag the story part that names the big amount into the big amount box. Then solve it and say how many out loud. ' },
  }),
  mode({
    evalMode: 'build_family', label: 'Build the Family', beta: 3.5, scaffoldingMode: 2,
    challengeTypes: ['build_family'],
    description: 'One-step addition or subtraction word problem with an unknown: build small plus small equals big, read the family with a box for the unknown, select add or subtract, then work it.',
    challengeDocs: { build_family: {
      promptDoc: '"build_family": the child drags all three story parts into small plus small equals big, READS the number family ("twelve plus box equals twenty"), says add or subtract, then works it. G2-3.',
      schemaDescription: "'build_family' (drag the story parts into small + small = big, read it, choose the operation, work it)",
    } },
    responseClass: (item) => item.maxNumber <= 20 ? 'number_word_to_20' : 'number_word_to_120',
    answerStepId: 'solve', steps: [bigNumber, family, operation, solve], groupingKey: (item) => item.challengeType,
    metadata: { howToPlay: 'We are going to set up word problems. First, listen to the story. Next, drag all three story parts to build small plus small equals big. Then read your number family out loud, choose add or subtract, and solve it. Say box for the amount we do not know. ' },
  }),
  mode({
    evalMode: 'classify_and_build', label: 'Classify, then Build', beta: 4.5, scaffoldingMode: 3,
    challengeTypes: ['classify_and_build'],
    description: 'One-step addition or subtraction word problem: distinguish the story kind (comparison, change, part-whole) first, then build the number family and work it.',
    challengeDocs: { classify_and_build: {
      promptDoc: '"classify_and_build": the child first names the story kind (comparison / change / part-whole), then builds the family and works it. G3-4.',
      schemaDescription: "'classify_and_build' (name the kind, then build the family and work it)",
    } },
    responseClass: (item) => item.maxNumber <= 20 ? 'number_word_to_20' : 'number_word_to_120',
    answerStepId: 'solve', steps: [classify, bigNumber, family, operation, solve], groupingKey: (item) => item.challengeType,
    metadata: { howToPlay: 'We are going to set up word problems. First, listen and say what kind of problem it is. Next, drag all three story parts to build small plus small equals big. Then read your number family out loud, choose add or subtract, and solve it. Say box for the amount we do not know. ' },
  }),
);

export const DI_WORD_PROBLEM_EVAL_MODES = evalModeDefinitionsFromDiModes(DI_WORD_PROBLEM_MODES);
export const DI_WORD_PROBLEM_TYPE_DOCS = challengeTypeDocsFromDiModes(DI_WORD_PROBLEM_MODES);
export const DI_WORD_PROBLEM_CHALLENGE_TYPES = DI_WORD_PROBLEM_MODES.flatMap(
  (definition) => definition.challengeTypes,
) as WordProblemChallengeType[];
export const STEPS_FOR_MODE = Object.fromEntries(
  DI_WORD_PROBLEM_MODES.map((definition) => [
    definition.challengeTypes[0],
    definition.steps.map((candidate) => candidate.id as WordProblemStepKind),
  ]),
) as Record<WordProblemChallengeType, WordProblemStepKind[]>;
export const HOW_TO_PLAY = Object.fromEntries(
  DI_WORD_PROBLEM_MODES.map((definition) => [definition.challengeTypes[0], definition.metadata!.howToPlay]),
) as Record<WordProblemChallengeType, string>;
export const diWordProblemModePlan = (item: WordProblemModePlanItem) =>
  buildDiModePlan(DI_WORD_PROBLEM_MODES, item);
