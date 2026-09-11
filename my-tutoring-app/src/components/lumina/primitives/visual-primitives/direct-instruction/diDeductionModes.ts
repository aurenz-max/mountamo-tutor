import type { ResponseClassId } from '../../../hooks/judgedScriptContract';
import {
  buildDiModePlan,
  challengeTypeDocsFromDiModes,
  defineDiMode,
  defineDiModes,
  evalModeDefinitionsFromDiModes,
  type DiModeItem,
} from '../../../hooks/diModeContract';
import { withArticle, type DeductionShape } from './diDeductionPlan';

export type DeductionChallengeType = DeductionShape;

interface DeductionModeMetadata {
  howToPlay: string;
}

export interface DeductionModePlanItem extends DiModeItem {
  challengeType: DeductionChallengeType;
  action: 'deduce';
  responseClass: ResponseClassId;
  shape: DeductionShape;
  case: { subject: string };
  rule: { category: string };
}

export const VERDICT_MENU = "yes, no, or can't tell";

const HOW_TO_PLAY =
  'We are going to use rules. I read a rule and a fact, and you tell me what the rule says about it, '
  + 'and how you know. Use only the rule, not what you already know. Sometimes the rule cannot tell you; '
  + 'then you say can\'t tell. ';

const instructionFor = (item: DeductionModePlanItem): string =>
  item.shape === 'conclude'
    ? `Say what the rule tells you about ${item.case.subject}.`
    : `Is ${item.case.subject} ${withArticle(item.rule.category)}? Say ${VERDICT_MENU}—then explain using the rule.`;

const mode = defineDiMode<DeductionModePlanItem, DeductionModeMetadata>();

export const DI_DEDUCTION_MODES = defineDiModes<DeductionModePlanItem, DeductionModeMetadata>(
  mode({
    evalMode: 'conclude',
    label: 'What Follows',
    beta: 2.5,
    scaffoldingMode: 1,
    challengeTypes: ['conclude'],
    description: 'The case names a member of the rule\'s category; the child says what the rule tells them about it (affirm the antecedent).',
    challengeDocs: {
      conclude: {
        promptDoc:
          '"conclude": the case names a MEMBER of the rule\'s category ("A beetle is an insect") and the child '
          + 'says what the rule tells them about it ("so a beetle has six legs").',
        schemaDescription: "'conclude' (apply a rule to a named member)",
      },
    },
    responseClass: (item) => item.responseClass,
    answerStepId: 'answer',
    groupingKey: () => 'deduce',
    metadata: { howToPlay: HOW_TO_PLAY },
    steps: [{
      id: 'answer',
      actionId: (item) => item.shape,
      label: 'State what follows',
      icon: '→',
      answerKind: 'voice',
      instruction: instructionFor,
      checkingInstruction: 'Listening for what follows from the rule.',
    }],
  }),
  mode({
    evalMode: 'deny',
    label: 'Rule It Out',
    beta: 3.5,
    scaffoldingMode: 2,
    challengeTypes: ['deny'],
    description: 'The case names a thing that lacks the property; the child rules it out and says why (deny the consequent).',
    challengeDocs: {
      deny: {
        promptDoc:
          '"deny": the case names a thing that LACKS the property ("A spider does not have six legs") and the '
          + 'child rules it out with a reason ("no, not an insect, because all insects have six legs").',
        schemaDescription: "'deny' (rule a thing out using the rule)",
      },
    },
    responseClass: (item) => item.responseClass,
    answerStepId: 'answer',
    groupingKey: () => 'deduce',
    metadata: { howToPlay: HOW_TO_PLAY },
    steps: [{
      id: 'answer',
      actionId: (item) => item.shape,
      label: 'Choose and explain',
      icon: 'no',
      answerKind: 'voice',
      instruction: instructionFor,
      checkingInstruction: 'Listening for your verdict and reason.',
    }],
  }),
  mode({
    evalMode: 'cannot_tell',
    label: "Can't Tell",
    beta: 4.5,
    scaffoldingMode: 3,
    challengeTypes: ['cannot_tell'],
    description: 'The case names only the property of an unnamed thing; the child says the rule cannot tell whether it is a member, and why — the confident yes is the signature error.',
    challengeDocs: {
      cannot_tell: {
        promptDoc:
          '"cannot_tell": the case names only the property of an unnamed thing ("This animal has six legs") '
          + 'and the child must say the rule cannot tell whether it is a member, and why (other things have '
          + 'six legs too) — the reasoning standard where "yes, because it has six legs" is the error.',
        schemaDescription: "'cannot_tell' (recognize that the rule does not run backwards)",
      },
    },
    responseClass: (item) => item.responseClass,
    answerStepId: 'answer',
    groupingKey: () => 'deduce',
    metadata: { howToPlay: HOW_TO_PLAY },
    steps: [{
      id: 'answer',
      actionId: (item) => item.shape,
      label: 'Choose and explain',
      icon: '?',
      answerKind: 'voice',
      instruction: instructionFor,
      checkingInstruction: 'Listening for your verdict and reason.',
    }],
  }),
);

export const DI_DEDUCTION_EVAL_MODES = evalModeDefinitionsFromDiModes(DI_DEDUCTION_MODES);
export const DI_DEDUCTION_TYPE_DOCS = challengeTypeDocsFromDiModes(DI_DEDUCTION_MODES);
export const DI_DEDUCTION_CHALLENGE_TYPES = DI_DEDUCTION_MODES.flatMap(
  (definition) => definition.challengeTypes,
) as DeductionChallengeType[];
export const DEDUCTION_HOW_TO_PLAY = DI_DEDUCTION_MODES[0].metadata!.howToPlay;

export const diDeductionModePlan = (item: DeductionModePlanItem) =>
  buildDiModePlan(DI_DEDUCTION_MODES, item);
