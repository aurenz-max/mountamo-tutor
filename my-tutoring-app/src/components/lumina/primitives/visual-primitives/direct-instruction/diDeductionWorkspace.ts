/**
 * di-deduction on the shared tutor/JEV teaching workspace (rollout C6), through `DiTeachingStage`.
 * A rule card and a case card are printed; the child says what the rule tells them about the case, and
 * on `deny` and `cannot_tell` a verdict with its reason. Pure: the component and the journey read the
 * same assignment and scene.
 *
 * What the scripted judging contract carried that is task structure stays in the key, one per case
 * shape: the conclusion in any words; for `deny` a no WITH the reason from the rule (a bare no is the
 * right verdict with the reason missing, not yet the answer); for `cannot_tell` the rule does not run
 * backwards, so "yes, because it has the property" is the signature error and "can't tell" needs its
 * reason. The sentinel lines, correction branches and move-on carry were control protocol and are gone:
 * a wrong answer no longer closes a case, so the page never writes a conclusion the child did not earn.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withArticle } from './diDeductionPlan';
import { VERDICT_MENU, itemsFromRules, withDeductionAction, type DeductionItem, type DiDeductionData } from './diDeductionScript';

/** The items a payload asks, built by the one builder the generator and the drive harness use. */
export const deductionItems = (data: Pick<DiDeductionData, 'rules' | 'supportTier'>): DeductionItem[] =>
  itemsFromRules(data.rules ?? [], data.supportTier).items;

/** The question the child hears; the rule and the case are printed above it. */
export const deductionAskFor = (item: DeductionItem): string => withDeductionAction(item).actionContract.instruction;

export function deductionKey(item: DeductionItem): string {
  const r = item.rule;
  const s = item.case.subject;
  const cat = withArticle(r.category);
  if (item.shape === 'conclude') {
    return `That ${s} ${r.propertySingular}, in any words ("it ${r.propertySingular}", or the property alone). `
      + `The rule read back ("all ${r.categoryPlural} ${r.propertyPlural}"), the case read back, or a fact about ${s} `
      + 'the rule does not give is not an answer.';
  }
  if (item.shape === 'deny') {
    return `No, ${s} is not ${cat}, WITH the reason from the rule: all ${r.categoryPlural} ${r.propertyPlural} and `
      + `${s} ${r.propertyNegated} ("nope, it ${r.propertyNegated}" counts). A no with no reason, or a reason that `
      + `is not about whether it ${r.propertySingular}, has the right verdict and is not yet the answer.`;
  }
  const look = withArticle(item.case.lookalike ?? 'something else');
  return `Can't tell ("maybe", "not sure", "the rule doesn't say"), WITH the reason: the rule does not say only `
    + `${r.categoryPlural} ${r.propertyPlural}; other things do too (${look} ${r.propertySingular} and is not ${cat}). `
    + `"No, because other things ${r.propertyPlural} too" carries that reason and counts. "Yes, because it `
    + `${r.propertySingular}" is the signature error: the rule does not run backwards. Can't tell with no reason `
    + 'is not yet the answer.';
}

export function deductionAssignment(item: DeductionItem): TeachingAssignment {
  return { id: item.id, task: deductionAskFor(item), response: 'speech', expectedAnswer: deductionKey(item) };
}

export function deductionScene(item: DeductionItem): WorkspaceScene {
  return {
    objects: [
      { id: 'rule', selected: false, group: 'assignment target', label: `the rule card: "${item.ruleText}"` },
      { id: 'case', selected: false, group: 'assignment target', label: `the case card: "${item.case.caseText}"` },
    ],
    facts: { kind: item.shape, ...(item.supportTier ? { supportTier: item.supportTier } : {}),
      caseOfRule: `case ${item.caseIndex + 1} of this rule`,
      constraints: item.shape === 'conclude'
        ? 'The learner says aloud what the rule tells them about the case. Only the rule counts, not what they already know.'
        : `The learner says ${VERDICT_MENU} aloud, then the reason from the rule. The three words are printed as a `
          + 'guide; none is lit until an answer is credited. Only the rule counts, not what they already know.' },
  };
}

/** The journey's answers: the pack's own canonical utterance, or the case's plainest wrong verdict. */
export function diDeductionHarnessAnswers(item: DeductionItem): { correct: string; plainWrong: string } {
  const r = item.rule;
  const s = item.case.subject;
  if (item.shape === 'conclude') return { correct: item.answerSpoken, plainWrong: `${s} ${r.propertyNegated}` };
  if (item.shape === 'deny') return { correct: item.answerSpoken, plainWrong: `yes, ${s} is ${withArticle(r.category)}` };
  return { correct: item.answerSpoken, plainWrong: `yes, because it ${r.propertySingular}` };
}

/** A payload the stage can ask: at least one rule, and every rule builds its cases. */
export function deductionDataValid(data: Pick<DiDeductionData, 'rules' | 'supportTier'>): boolean {
  if (!Array.isArray(data?.rules) || !data.rules.length) return false;
  const built = itemsFromRules(data.rules, data.supportTier);
  return built.dropped === 0 && built.items.length > 0;
}
