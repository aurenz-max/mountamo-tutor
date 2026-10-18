/**
 * di-worked-procedure items: the problem spec the generator emits, the step items built from it, and the one
 * builder (`itemsFromProblems`) the component, levers and workspace share. The tutor's words come from the boss
 * (`diWorkedProcedure.boss.ts`), not from this module.
 *
 * The child works a multi-digit subtraction out loud, one column at a time. Each column is a `decide` step
 * (regroup, or subtract cleanly), and a column that regroups adds a `subtract` step for its difference. The
 * canonical chain comes from `diWorkedProcedurePlan.ts`, never from the model.
 */

import type {
  DiActionContract,
  JudgedScriptItem,
} from '../../../hooks/judgedScriptContract';
import {
  numberWord,
  planSubtraction,
  PLACES,
  type Place,
  type SubtractionColumn,
  type SubtractionPlan,
} from './diWorkedProcedurePlan';
import {
  diWorkedProcedureModePlan,
  type WorkedProcedureChallengeType,
  type WorkedProcedureSupportTier,
  type WorkedStepKind,
} from './diWorkedProcedureModes';

export type {
  WorkedProcedureChallengeType,
  WorkedProcedureSupportTier,
  WorkedStepKind,
} from './diWorkedProcedureModes';

/** What the generator emits per problem. The step chain is built HERE from the
 *  two numbers; a spec that fails the plan gates is dropped, never backfilled. */
export interface WorkedProblemSpec {
  id: string;
  minuend: number;
  subtrahend: number;
  challengeType: WorkedProcedureChallengeType;
  /** How much the tutor models before the learner tries (`supportFact`). */
  supportTier?: WorkedProcedureSupportTier;
}

export interface WorkedProcedureItem extends JudgedScriptItem {
  action: 'talk_through';
  kind: WorkedStepKind;
  challengeType: WorkedProcedureChallengeType;
  supportTier?: WorkedProcedureSupportTier;
  problemId: string;
  /** Position of this problem in the session (0-based). */
  problemIndex: number;
  /** Position of this step within its problem (0-based). */
  stepIndex: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  minuend: number;
  subtrahend: number;
  /** "53 − 28" — the printed stimulus. Never contains the answer. */
  problemDisplay: string;
  /** "fifty-three minus twenty-eight". */
  problemSpoken: string;
  finalDifference: number;
  columnIndex: number;
  place: Place;
  column: SubtractionColumn;
  /** decide only: the correct move is to regroup. */
  regroup: boolean;
  /** decide+regroup only: the digit the place above reads after lending. */
  newAbove: number;
  placeAbove: Place | null;
  /** The canonical utterance, for evidence and the harness. */
  answerSpoken: string;
}

export type ActionableWorkedProcedureItem = WorkedProcedureItem & {
  actionContract: DiActionContract;
};

export interface DiWorkedProcedureData {
  title: string;
  description: string;
  challengeType: WorkedProcedureChallengeType;
  problems: WorkedProblemSpec[];
  gradeLevel?: string;
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  componentIntent?: string;
  objectiveText?: string;
  onEvaluationSubmit?: (result: unknown) => void;
}

const w = numberWord;
const MINUS = '−';

const problemDisplayOf = (minuend: number, subtrahend: number): string =>
  `${minuend} ${MINUS} ${subtrahend}`;
const problemSpokenOf = (minuend: number, subtrahend: number): string =>
  `${w(minuend)} minus ${w(subtrahend)}`;

// ── Items from problems (the ONE builder) ────────────────────────────────────

const stepsForPlan = (
  spec: WorkedProblemSpec,
  plan: SubtractionPlan,
  problemIndex: number,
): WorkedProcedureItem[] => {
  const base = {
    action: 'talk_through' as const,
    answerKind: 'voice' as const,
    challengeType: spec.challengeType,
    supportTier: spec.supportTier,
    problemId: spec.id,
    problemIndex,
    minuend: plan.minuend,
    subtrahend: plan.subtrahend,
    problemDisplay: problemDisplayOf(plan.minuend, plan.subtrahend),
    problemSpoken: problemSpokenOf(plan.minuend, plan.subtrahend),
    finalDifference: plan.difference,
  };
  const items: WorkedProcedureItem[] = [];
  plan.columns.forEach((column, columnIndex) => {
    const placeAbove = column.regroup ? PLACES[columnIndex + 1] : null;
    const newAbove = column.regroup ? plan.columns[columnIndex + 1].top - 1 : -1;
    const decide: WorkedProcedureItem = {
      ...base,
      id: `${spec.id}-c${columnIndex}-decide`,
      kind: 'decide',
      responseClass: 'procedure_step',
      stepIndex: items.length,
      isFirstStep: items.length === 0,
      isLastStep: !column.regroup && columnIndex === plan.columns.length - 1,
      columnIndex,
      place: column.place,
      column,
      regroup: column.regroup,
      newAbove,
      placeAbove,
      answerSpoken: column.regroup
        ? `I can't take ${w(column.bottom)} from ${w(column.topAfterLend)}, so I regroup: `
          + `${w(newAbove)} ${placeAbove}, ${w(column.effectiveTop)} ${column.place}`
        : `no regrouping, ${w(column.topAfterLend)} minus ${w(column.bottom)} is ${w(column.difference)}`,
    };
    items.push(withWorkedProcedureAction(decide));
    if (column.regroup) {
      items.push(withWorkedProcedureAction({
        ...base,
        id: `${spec.id}-c${columnIndex}-subtract`,
        kind: 'subtract',
        responseClass: 'number_word_to_20',
        stepIndex: items.length,
        isFirstStep: false,
        isLastStep: false,
        columnIndex,
        place: column.place,
        column,
        regroup: false,
        newAbove: -1,
        placeAbove: null,
        answerSpoken: w(column.difference),
      }));
    }
  });
  return items;
};

/**
 * Build the judged items for a session. Problems that fail the plan gates are
 * DROPPED and counted — a placeholder step in a judged loop becomes a spoken
 * ask the tutor must judge, so nothing is ever backfilled.
 */
export function itemsFromProblems(problems: readonly WorkedProblemSpec[]): {
  items: WorkedProcedureItem[];
  dropped: number;
} {
  const items: WorkedProcedureItem[] = [];
  let dropped = 0;
  let problemIndex = 0;
  for (const spec of problems) {
    const plan = planSubtraction(spec.minuend, spec.subtrahend);
    if (!plan) { dropped++; continue; }
    // A mode promise is a content gate: a no-regroup session must not contain a
    // regroup, and a regroup session must regroup at least once.
    if (spec.challengeType === 'subtract_no_regroup' && plan.regroupCount > 0) { dropped++; continue; }
    if (spec.challengeType === 'subtract_regroup' && plan.regroupCount === 0) { dropped++; continue; }
    items.push(...stepsForPlan(spec, plan, problemIndex));
    problemIndex++;
  }
  return { items, dropped };
}

/** Attach the step's action contract: the exact current move shown on screen and asked aloud. */
export const withWorkedProcedureAction = (
  item: WorkedProcedureItem,
): ActionableWorkedProcedureItem => {
  const actionContract = diWorkedProcedureModePlan(item).answerStep.actionContract;
  return { ...item, answerKind: actionContract.answerKind, actionContract };
};
