/**
 * di-deduction items: the rule spec the generator emits, the case items built from it, and the one builder
 * (`itemsFromRules`) the component, levers and workspace share. The tutor's words come from the boss
 * (`diDeduction.boss.ts`), not from this module.
 *
 * Two cards, a RULE and a CASE, and the child says what the rule tells them and how they know. Each rule is
 * worked through its case shapes (conclude, deny, cannot_tell); the cases come from `diDeductionPlan.ts`,
 * never from the model.
 */

import type {
  DiActionContract,
  JudgedScriptItem,
} from '../../../hooks/judgedScriptContract';
import {
  planCases,
  ruleTextOf,
  sanitizeRule,
  withArticle,
  type DeductionCase,
  type DeductionRuleSpec,
  type DeductionShape,
} from './diDeductionPlan';
import {
  diDeductionModePlan,
  type DeductionChallengeType,
} from './diDeductionModes';

export type { DeductionRuleSpec, DeductionShape, DeductionCase } from './diDeductionPlan';
export type { DeductionChallengeType } from './diDeductionModes';

/** How much the tutor models before the learner tries (`supportFact`). */
export type DeductionSupportTier = 'easy' | 'medium' | 'hard';

export interface DeductionItem extends JudgedScriptItem {
  action: 'deduce';
  responseClass: 'deduction';
  answerKind: 'voice';
  challengeType: DeductionChallengeType;
  shape: DeductionShape;
  supportTier?: DeductionSupportTier;
  ruleId: string;
  /** Position of this rule in the session (0-based). */
  ruleIndex: number;
  /** Position of this case within its rule (0-based). */
  caseIndex: number;
  isFirstCase: boolean;
  isLastCase: boolean;
  rule: DeductionRuleSpec;
  /** "All insects have six legs." — the printed rule card. */
  ruleText: string;
  case: DeductionCase;
  /** The canonical utterance, for evidence and the harness. */
  answerSpoken: string;
}

export type ActionableDeductionItem = DeductionItem & {
  actionContract: DiActionContract;
};

export interface DiDeductionData {
  title: string;
  description: string;
  challengeType: DeductionChallengeType;
  rules: DeductionRuleSpec[];
  /** Truth-reviewed rules the session never asks, sharing no content word with it: the levers' model and practice
   *  case (ruling R3). Never items. */
  spares?: DeductionRuleSpec[];
  supportTier?: DeductionSupportTier;
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

// ── Items from rules (the ONE builder) ───────────────────────────────────────

const itemsForRule = (
  rule: DeductionRuleSpec,
  ruleIndex: number,
  supportTier: DeductionSupportTier | undefined,
): DeductionItem[] => {
  const cases = planCases(rule);
  const ruleText = ruleTextOf(rule);
  const cat = withArticle(rule.category);
  return cases.map((c, caseIndex) => {
    const answerSpoken = c.shape === 'conclude'
      ? `${c.subject} ${rule.propertySingular}`
      : c.shape === 'deny'
        ? `no, ${c.subject} is not ${cat}, because all ${rule.categoryPlural} ${rule.propertyPlural} and ${c.subject} ${rule.propertyNegated}`
        : `can't tell, because the rule does not say only ${rule.categoryPlural} ${rule.propertyPlural}`;
    return withDeductionAction({
      id: `${rule.id}-c${caseIndex}-${c.shape}`,
      action: 'deduce' as const,
      answerKind: 'voice' as const,
      responseClass: 'deduction' as const,
      challengeType: c.shape,
      shape: c.shape,
      ...(supportTier ? { supportTier } : {}),
      ruleId: rule.id,
      ruleIndex,
      caseIndex,
      isFirstCase: caseIndex === 0,
      isLastCase: caseIndex === cases.length - 1,
      rule,
      ruleText,
      case: c,
      answerSpoken,
    });
  });
};

/**
 * Build the judged items for a session. Rules that fail the plan gates, or
 * that build NO case for the shapes they promised, are DROPPED and counted —
 * a placeholder case in a judged loop becomes a spoken ask the tutor must
 * judge, so nothing is ever backfilled.
 */
export function itemsFromRules(
  rules: readonly DeductionRuleSpec[],
  supportTier?: DeductionSupportTier,
): { items: DeductionItem[]; dropped: number } {
  const items: DeductionItem[] = [];
  let dropped = 0;
  let ruleIndex = 0;
  for (const raw of rules) {
    const rule = sanitizeRule(raw as unknown as Record<string, unknown>, raw.id);
    if (!rule) { dropped++; continue; }
    const built = itemsForRule(rule, ruleIndex, supportTier);
    if (built.length === 0) { dropped++; continue; }
    items.push(...built);
    ruleIndex++;
  }
  return { items, dropped };
}

export { VERDICT_MENU } from './diDeductionModes';

/** Upgrade a case into the shared action contract: the exact action sentence shown on screen and asked aloud. */
export const withDeductionAction = (item: DeductionItem): ActionableDeductionItem => {
  const actionContract = diDeductionModePlan(item).answerStep.actionContract;
  if (actionContract.answerKind !== 'voice') {
    throw new Error(`Deduction mode ${item.challengeType} must use a voice answer`);
  }
  return { ...item, answerKind: 'voice', actionContract };
};

