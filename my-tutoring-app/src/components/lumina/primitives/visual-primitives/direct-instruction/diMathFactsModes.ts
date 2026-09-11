import {
  buildDiModePlan, challengeTypeDocsFromDiModes, defineDiMode, defineDiModes,
  evalModeDefinitionsFromDiModes, type DiModeItem,
} from '../../../hooks/diModeContract';

export type DiMathFactsChallengeType =
  | 'name_numeral' | 'counting_next' | 'answer_fact' | 'fact_review' | 'subtraction_fact';

export interface MathFactsModePlanItem extends DiModeItem {
  challengeType: DiMathFactsChallengeType;
  problem: string;
  answerNumeral: number;
}

const responseClassFor = (item: MathFactsModePlanItem) =>
  item.answerNumeral <= 20 ? 'number_word_to_20' as const : 'number_word_to_120' as const;
const mode = defineDiMode<MathFactsModePlanItem>();
const step = {
  id: 'answer',
  actionId: (item: MathFactsModePlanItem) => `${item.id}-answer`,
  label: (item: MathFactsModePlanItem) => item.challengeType === 'name_numeral'
    ? 'Name the number'
    : 'Say the answer',
  icon: '➕', answerKind: 'voice' as const,
  instruction: (item: MathFactsModePlanItem) => `Your turn. What is ${item.problem}?`,
  checkingInstruction: 'Listening to your answer.',
};

export const DI_MATH_FACTS_MODES = defineDiModes<MathFactsModePlanItem>(
  mode({
    evalMode: 'name_numeral', label: 'Name the Number', beta: 1.5, scaffoldingMode: 1,
    challengeTypes: ['name_numeral'],
    description: 'See one printed numeral, say its name aloud — recognition and production, no computation.',
    challengeDocs: { name_numeral: {
      promptDoc: '"name_numeral": the child sees ONE printed numeral and says its name aloud. Pure numeral recognition and production — no computation, no sequence.',
      schemaDescription: "'name_numeral' (say the printed numeral's name)",
    } },
    responseClass: responseClassFor, answerStepId: 'answer',
    groupingKey: (item) => item.challengeType, steps: [step],
  }),
  mode({
    evalMode: 'counting_next', label: 'The Number After', beta: 1.5, scaffoldingMode: 1,
    challengeTypes: ['counting_next'],
    description: 'See a number, say the number that comes next — the rote counting sequence underneath counting on.',
    challengeDocs: { counting_next: {
      promptDoc: '"counting_next": the child sees a number and says the number that comes NEXT. Rote counting sequence — the skill underneath counting on.',
      schemaDescription: "'counting_next' (say the number after)",
    } },
    responseClass: responseClassFor, answerStepId: 'answer',
    groupingKey: (item) => item.challengeType, steps: [step],
  }),
  mode({
    evalMode: 'answer_fact', label: 'Answer a Fact', beta: 2.0, scaffoldingMode: 1,
    challengeTypes: ['answer_fact'],
    description: 'See one printed addition fact, say the answer as a number word — modeled and guided first, then answered alone.',
    challengeDocs: { answer_fact: {
      promptDoc: '"answer_fact": the child sees ONE printed addition fact and speaks the answer number word. The base skill, drilled as the objective\'s focused set.',
      schemaDescription: "'answer_fact' (say the answer to the printed fact)",
    } },
    responseClass: responseClassFor, answerStepId: 'answer',
    groupingKey: (item) => item.challengeType, steps: [step],
  }),
  mode({
    evalMode: 'fact_review', label: 'Fact Review (Mixed Set)', beta: 2.5, scaffoldingMode: 2,
    challengeTypes: ['fact_review'],
    description: 'Cumulative / spaced review — answer already-taught facts drawn as a wide mix across the whole grade range, not one focused set.',
    challengeDocs: { fact_review: {
      promptDoc: '"fact_review": cumulative / spaced review — the child answers facts already taught, drawn as a WIDE mix across the whole grade range rather than one focused set.',
      schemaDescription: "'fact_review' (mixed cumulative review)",
    } },
    responseClass: responseClassFor, answerStepId: 'answer',
    groupingKey: (item) => item.challengeType, steps: [step],
  }),
  mode({
    evalMode: 'subtraction_fact', label: 'Take-Away Fact', beta: 3.0, scaffoldingMode: 3,
    challengeTypes: ['subtraction_fact'],
    description: 'See one printed subtraction fact, say the difference as a number word. Same range as the addition facts; counting back is a legitimate route.',
    challengeDocs: { subtraction_fact: {
      promptDoc: '"subtraction_fact": the child sees ONE printed subtraction fact and speaks the answer number word. Take-away facts within the same range.',
      schemaDescription: "'subtraction_fact' (say the answer to a take-away fact)",
    } },
    responseClass: responseClassFor, answerStepId: 'answer',
    groupingKey: (item) => item.challengeType, steps: [step],
  }),
);

export const DI_MATH_FACTS_EVAL_MODES = evalModeDefinitionsFromDiModes(DI_MATH_FACTS_MODES);
export const DI_MATH_FACTS_TYPE_DOCS = challengeTypeDocsFromDiModes(DI_MATH_FACTS_MODES);
export const DI_MATH_FACTS_CHALLENGE_TYPES = DI_MATH_FACTS_MODES.flatMap(
  (definition) => definition.challengeTypes,
) as DiMathFactsChallengeType[];
export const diMathFactsModePlan = (item: MathFactsModePlanItem) =>
  buildDiModePlan(DI_MATH_FACTS_MODES, item);
