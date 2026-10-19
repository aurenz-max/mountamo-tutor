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
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { capitalize, withArticle } from './diDeductionPlan';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import { VERDICT_MENU, itemsFromRules, withDeductionAction, type DeductionItem, type DiDeductionData } from './diDeductionScript';

/** The items a payload asks, built by the one builder the generator and the drive harness use. */
export const deductionItems = (data: Pick<DiDeductionData, 'rules' | 'supportTier'>): DeductionItem[] =>
  itemsFromRules(data.rules ?? [], data.supportTier).items;

/** The question the child hears; the rule and the case are printed above it. */
export const deductionAskFor = (item: DeductionItem): string => withDeductionAction(item).actionContract.instruction;

/** The key the tutor judges with: a meaning key (`spokenKeyText`), since a verdict and its reason come in any words. */
export function deductionKey(item: DeductionItem): SpokenKey {
  const r = item.rule;
  const s = item.case.subject;
  const cat = withArticle(r.category);
  if (item.shape === 'conclude') {
    return ({ answer: item.answerSpoken, alsoAccept: [`it ${r.propertySingular}`],
      meaning: { idea: `${capitalize(s)} ${r.propertySingular}.`,
        notIt: `the rule read back ("all ${r.categoryPlural} ${r.propertyPlural}"), the case read back, or a fact about ${s} the rule does not give` } });
  }
  if (item.shape === 'deny') {
    return ({ answer: item.answerSpoken, alsoAccept: [`nope, it ${r.propertyNegated}`],
      meaning: { idea: `No, ${s} is not ${cat}, because all ${r.categoryPlural} ${r.propertyPlural} and ${s} ${r.propertyNegated}.`,
        notIt: `a reason that is not about whether it ${r.propertySingular}` },
      signatureError: 'A no with no reason has the right verdict and is not yet the answer.' });
  }
  const look = withArticle(item.case.lookalike ?? 'something else');
  return ({ answer: item.answerSpoken, alsoAccept: ['maybe, the rule does not say', `no, because other things ${r.propertyPlural} too`],
    meaning: { idea: `Can't tell, because the rule does not say only ${r.categoryPlural} ${r.propertyPlural}; other things do too `
      + `(${look} ${r.propertySingular} and is not ${cat}).`, notIt: "a can't-tell with no reason" },
    signatureError: `"Yes, because it ${r.propertySingular}" is the signature error: the rule does not run backwards.` });
}

/** What a wrong spoken deduction shows (handoff 20 Part B). */
export type SpokenDeductionMiss = 'said_negation' | 'read_rule_back' | 'read_case_back' | 'said_member' | 'said_cannot_tell'
  | 'backwards_yes' | 'said_not_member' | 'verdict_without_reason';

/**
 * A case's known wrong answers, in precedence order, for the `spoken_miss` observer: the rule and the case
 * stated first, then the learner's verdict or words. Concrete per case, never a cause.
 */
export function deductionSpokenMisses(item: DeductionItem): KnownMiss[] {
  const r = item.rule, s = item.case.subject, cat = withArticle(r.category);
  const fact = `The rule is "${item.ruleText}" The case is "${item.case.caseText}"`;
  if (item.shape === 'conclude') {
    return [
      { id: 'said_negation', pattern: `${fact} So ${s} ${r.propertySingular}. The learner says the opposite: ${s} ${r.propertyNegated}.`,
        examples: [`it ${r.propertyNegated}`] },
      { id: 'read_rule_back', pattern: `${fact} The learner only reads the rule back ("all ${r.categoryPlural} ${r.propertyPlural}") and says nothing about ${s}.`,
        examples: [`all ${r.categoryPlural} ${r.propertyPlural}`] },
      { id: 'read_case_back', pattern: `${fact} The learner only reads the case back and does not say that ${s} ${r.propertySingular}.`,
        examples: [item.case.caseText.replace(/\.$/, '')] },
    ];
  }
  if (item.shape === 'deny') {
    return [
      { id: 'said_member', pattern: `${fact} So ${s} is not ${cat}. The learner's verdict is yes, that ${s} is ${cat}.`,
        examples: [`yes, it is ${cat}`] },
      { id: 'said_cannot_tell', pattern: `${fact} So ${s} is not ${cat}. The learner's verdict is can't tell.`, examples: ["can't tell"] },
      { id: 'verdict_without_reason', pattern: `${fact} So ${s} is not ${cat}. The learner says only no, with no reason from the rule.`,
        examples: ['no'] },
    ];
  }
  return [
    { id: 'backwards_yes', pattern: `${fact} The rule does not say only ${r.categoryPlural} ${r.propertyPlural}. The learner's verdict is yes, `
      + `that it is ${cat} because it ${r.propertySingular}.`, examples: [`yes, because it ${r.propertySingular}`] },
    { id: 'said_not_member', pattern: `${fact} The rule does not say only ${r.categoryPlural} ${r.propertyPlural}. The learner's verdict is no, `
      + `it is not ${cat}, with no reason about other things that ${r.propertyPlural}.`, examples: [`no, it is not ${cat}`] },
    { id: 'verdict_without_reason', pattern: `${fact} The learner says only can't tell (or maybe), with no reason from the rule.`,
      examples: ["can't tell"] },
  ];
}

export function deductionScene(item: DeductionItem): SceneOf {
  return {
    objects: [
      { id: 'rule', selected: false, group: 'assignment target', label: `the rule card: "${item.ruleText}"` },
      { id: 'case', selected: false, group: 'assignment target', label: `the case card: "${item.case.caseText}"` },
    ],
    facts: { kind: item.shape,
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
