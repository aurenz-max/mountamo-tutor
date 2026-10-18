/**
 * di-word-problem-setup items: the problem spec the generator emits, the step items built from it, and the
 * one builder (`itemsFromProblems`) the component, levers and workspace share. The tutor's words come from the
 * boss (`diWordProblemSetup.boss.ts`), not from this module.
 *
 * A problem is worked one decision at a time — classify, place the big number (hands), say the family,
 * choose the operation, solve — and the mode decides which of those steps run (`STEPS_FOR_MODE`). Every story,
 * family and answer comes from `diWordProblemPlan.ts`, never from the model.
 */

import type {
  DiActionContract,
  JudgedScriptItem,
} from '../../../hooks/judgedScriptContract';
import {
  familySpoken,
  numberWord,
  planWordProblem,
  SHAPE_WORD,
  type WordProblemPlan,
  type WordProblemSpec,
} from './diWordProblemPlan';
import {
  diWordProblemModePlan,
  STEPS_FOR_MODE,
  type WordProblemChallengeType,
  type WordProblemStepKind,
  type WordProblemSupportTier,
} from './diWordProblemModes';
export type {
  WordProblemChallengeType,
  WordProblemStepKind,
  WordProblemSupportTier,
} from './diWordProblemModes';

/** What the generator emits per problem. The plan is built HERE from the
 *  frame, theme and two numbers; a spec that fails the plan gates is dropped,
 *  never backfilled. */
export interface WordProblemProblemSpec extends WordProblemSpec {
  challengeType: WordProblemChallengeType;
  supportTier?: WordProblemSupportTier;
  /** The session's number ceiling (20 unless the objective says within 100). */
  maxNumber?: number;
}

export interface WordProblemItem extends JudgedScriptItem {
  action: WordProblemChallengeType;
  /** Required here even though the family base allows incremental adoption. */
  actionContract: DiActionContract;
  kind: WordProblemStepKind;
  challengeType: WordProblemChallengeType;
  supportTier?: WordProblemSupportTier;
  problemId: string;
  problemIndex: number;
  stepIndex: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  plan: WordProblemPlan;
  /** The canonical utterance (voice) or the big quantity's id (gesture) —
   *  for evidence and the harness. */
  answerSpoken: string;
}

export interface DiWordProblemSetupData {
  title: string;
  description: string;
  challengeType: WordProblemChallengeType;
  problems: WordProblemProblemSpec[];
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

// ── Items from problems (the ONE builder) ────────────────────────────────────

const canonicalFor = (kind: WordProblemStepKind, plan: WordProblemPlan): string => {
  switch (kind) {
    case 'classify': return SHAPE_WORD[plan.shape];
    case 'big_number': return plan.big.id;
    case 'family': return familySpoken(plan);
    case 'operation': return plan.operation;
    case 'solve': return w(plan.answer);
  }
};

/**
 * Build the judged items for a session. Problems that fail the plan gates are
 * DROPPED and counted — a placeholder step in a judged loop becomes a spoken
 * ask the tutor must judge, so nothing is ever backfilled.
 */
export function itemsFromProblems(problems: readonly WordProblemProblemSpec[]): {
  items: WordProblemItem[];
  dropped: number;
} {
  const items: WordProblemItem[] = [];
  let dropped = 0;
  let problemIndex = 0;
  for (const spec of problems) {
    const maxNumber = spec.maxNumber ?? 20;
    const plan = planWordProblem(spec, maxNumber);
    if (!plan || !STEPS_FOR_MODE[spec.challengeType]) { dropped++; continue; }
    const modePlan = diWordProblemModePlan({
      id: spec.id,
      challengeType: spec.challengeType,
      plan,
      maxNumber,
    });
    const kinds = STEPS_FOR_MODE[spec.challengeType];
    kinds.forEach((kind, stepIndex) => {
      const step = modePlan.steps.find((candidate) => candidate.key === kind)!;
      const actionContract = step.actionContract;
      items.push({
        id: `${spec.id}-${kind}`,
        action: spec.challengeType,
        answerKind: actionContract.answerKind,
        actionContract,
        responseClass: step.responseClass!,
        kind,
        challengeType: spec.challengeType,
        supportTier: spec.supportTier,
        problemId: spec.id,
        problemIndex,
        stepIndex,
        isFirstStep: stepIndex === 0,
        isLastStep: stepIndex === kinds.length - 1,
        plan,
        answerSpoken: canonicalFor(kind, plan),
      });
    });
    problemIndex++;
  }
  return { items, dropped };
}
