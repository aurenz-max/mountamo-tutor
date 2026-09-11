import type { DiActionContract, ResponseClassId } from '../../../hooks/judgedScriptContract';
import {
  buildDiModePlan,
  challengeTypeDocsFromDiModes,
  defineDiMode,
  defineDiModes,
  evalModeDefinitionsFromDiModes,
  type DiModeItem,
  type DiModeStepDefinition,
} from '../../../hooks/diModeContract';
import { numberWord, type Place } from './diWorkedProcedurePlan';

export type WorkedProcedureChallengeType = 'subtract_no_regroup' | 'subtract_regroup';
export type WorkedProcedureSupportTier = 'easy' | 'medium' | 'hard';
export type WorkedStepKind = 'decide' | 'subtract';

interface WorkedProcedureModeMetadata {
  howToPlay: string;
}

export interface WorkedProcedureModePlanItem extends DiModeItem {
  challengeType: WorkedProcedureChallengeType;
  action: 'talk_through';
  responseClass: ResponseClassId;
  kind: WorkedStepKind;
  place: Place;
  regroup: boolean;
  supportTier?: WorkedProcedureSupportTier;
  column: {
    topAfterLend: number;
    effectiveTop: number;
    bottom: number;
  };
}

const HOW_TO_PLAY =
  'We are going to work subtraction out loud, one column at a time. I ask, and you tell me what you do. ';

export const workedProcedureColumnPhrase = (item: WorkedProcedureModePlanItem): string =>
  item.kind === 'subtract'
    ? `${numberWord(item.column.effectiveTop)} minus ${numberWord(item.column.bottom)}`
    : `${numberWord(item.column.topAfterLend)} minus ${numberWord(item.column.bottom)}`;

const instructionFor = (item: WorkedProcedureModePlanItem): string => {
  const digits = item.supportTier === 'easy' ? `: ${workedProcedureColumnPhrase(item)}` : '';
  if (item.kind === 'subtract') {
    return `Subtract the ${item.place} column${digits}, then say the result.`;
  }
  return item.regroup
    ? `Look at the ${item.place} column${digits}. Say why you need to regroup and what the digits become.`
    : `Look at the ${item.place} column${digits}. Say that you do not regroup, then subtract and say the result.`;
};

const actionStep: DiModeStepDefinition<WorkedProcedureModePlanItem> = {
  id: 'answer',
  actionId: (item) => `${item.kind}-${item.place}`,
  label: (item) => item.kind === 'subtract'
    ? `Subtract the ${item.place}`
    : `Decide in the ${item.place}`,
  icon: (item) => item.kind === 'subtract' ? '−' : '↻',
  answerKind: 'voice',
  instruction: instructionFor,
  checkingInstruction: (item) => item.kind === 'subtract'
    ? `Listening for the ${item.place} result.`
    : `Listening for your ${item.place}-column decision.`,
};

const mode = defineDiMode<WorkedProcedureModePlanItem, WorkedProcedureModeMetadata>();

export const DI_WORKED_PROCEDURE_MODES = defineDiModes<
  WorkedProcedureModePlanItem,
  WorkedProcedureModeMetadata
>(
  mode({
    evalMode: 'subtract_no_regroup',
    label: 'No Regrouping',
    beta: 2.0,
    scaffoldingMode: 1,
    challengeTypes: ['subtract_no_regroup'],
    description: 'Every column subtracts cleanly; the child says each column aloud and must decide NOT to regroup.',
    challengeDocs: {
      subtract_no_regroup: {
        promptDoc:
          '"subtract_no_regroup": a multi-digit subtraction where every column subtracts cleanly; the child '
          + 'says each column aloud ("four minus two is two") and must decide NOT to regroup.',
        schemaDescription: "'subtract_no_regroup' (talk through subtraction without regrouping)",
      },
    },
    responseClass: (item) => item.responseClass,
    answerStepId: 'answer',
    groupingKey: () => 'talk_through',
    metadata: { howToPlay: HOW_TO_PLAY },
    steps: [actionStep],
  }),
  mode({
    evalMode: 'subtract_regroup',
    label: 'With Regrouping',
    beta: 3.5,
    scaffoldingMode: 3,
    challengeTypes: ['subtract_regroup'],
    description: 'At least one column must regroup; the child says the move (borrow / trade / regroup and both new numbers), then each difference.',
    challengeDocs: {
      subtract_regroup: {
        promptDoc:
          '"subtract_regroup": a multi-digit subtraction where at least one column must regroup (borrow); '
          + 'the child says the move aloud ("I can\'t take eight from two, so I regroup: four tens, twelve '
          + 'ones") and then each difference.',
        schemaDescription: "'subtract_regroup' (talk through subtraction with regrouping)",
      },
    },
    responseClass: (item) => item.responseClass,
    answerStepId: 'answer',
    groupingKey: () => 'talk_through',
    metadata: { howToPlay: HOW_TO_PLAY },
    steps: [actionStep],
  }),
);

export const DI_WORKED_PROCEDURE_EVAL_MODES = evalModeDefinitionsFromDiModes(
  DI_WORKED_PROCEDURE_MODES,
);
export const DI_WORKED_PROCEDURE_TYPE_DOCS = challengeTypeDocsFromDiModes(
  DI_WORKED_PROCEDURE_MODES,
);
export const DI_WORKED_PROCEDURE_CHALLENGE_TYPES = DI_WORKED_PROCEDURE_MODES.flatMap(
  (definition) => definition.challengeTypes,
) as WorkedProcedureChallengeType[];
export const WORKED_PROCEDURE_HOW_TO_PLAY = DI_WORKED_PROCEDURE_MODES[0].metadata!.howToPlay;

export const diWorkedProcedureModePlan = (item: WorkedProcedureModePlanItem) =>
  buildDiModePlan(DI_WORKED_PROCEDURE_MODES, item);

export const workedProcedureAction = (item: WorkedProcedureModePlanItem): DiActionContract =>
  diWorkedProcedureModePlan(item).answerStep.actionContract;
